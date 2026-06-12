"""CRDT foundation for offline-first workspace synchronization.

Implements LWW-Register maps and OR-Set add-wins semantics for conflict-free merges.
State is held in-memory per workspace (Phase 3 foundation).
"""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _lww_merge(a: dict, b: dict) -> dict:
    """Merge two LWW register entries; higher timestamp wins, then node_id."""
    if not a:
        return b
    if not b:
        return a
    if a["ts"] > b["ts"]:
        return a
    if b["ts"] > a["ts"]:
        return b
    return a if a["node"] >= b["node"] else b


class LWWMap:
    """Last-Writer-Wins map — each key holds {value, ts, node}."""

    def __init__(self, data: Optional[dict] = None):
        self._data: dict[str, dict] = data or {}

    def set(self, key: str, value: Any, node: str, ts: Optional[str] = None) -> dict:
        entry = {"value": value, "ts": ts or _now(), "node": node}
        existing = self._data.get(key)
        self._data[key] = _lww_merge(existing, entry) if existing else entry
        return self._data[key]

    def get(self, key: str, default: Any = None) -> Any:
        entry = self._data.get(key)
        return entry["value"] if entry else default

    def to_dict(self) -> dict:
        return copy.deepcopy(self._data)

    def merge(self, remote: dict) -> None:
        for key, remote_entry in remote.items():
            local = self._data.get(key)
            self._data[key] = _lww_merge(local, remote_entry) if local else remote_entry

    def snapshot(self) -> dict[str, Any]:
        return {k: v["value"] for k, v in self._data.items()}


class ORSet:
    """Observed-Remove Set — add-wins; elements tracked with unique tags."""

    def __init__(self, adds: Optional[dict] = None, removes: Optional[set] = None):
        self._adds: dict[str, set] = adds or {}
        self._removes: set = removes or set()

    def add(self, element: str, tag: Optional[str] = None) -> str:
        tag = tag or str(uuid.uuid4())
        self._adds.setdefault(element, set()).add(tag)
        return tag

    def remove(self, element: str) -> None:
        if element in self._adds:
            self._removes.update(self._adds[element])

    def values(self) -> list[str]:
        return sorted(e for e, tags in self._adds.items() if not tags.issubset(self._removes))

    def to_dict(self) -> dict:
        return {
            "adds": {k: list(v) for k, v in self._adds.items()},
            "removes": list(self._removes),
        }

    def merge(self, remote: dict) -> None:
        for element, tags in remote.get("adds", {}).items():
            self._adds.setdefault(element, set()).update(tags)
        self._removes.update(remote.get("removes", []))


class WorkspaceCRDT:
    """Per-workspace CRDT document."""

    def __init__(self, workspace_id: int):
        self.workspace_id = workspace_id
        self.version = 0
        self.updated_at = _now()
        self.lww = LWWMap()
        self.feedback_ids = ORSet()
        self.feedback_items: dict[str, dict] = {}
        self.pending_ops: list[dict] = []

    def apply_op(self, op: dict) -> dict:
        op_type = op.get("type")
        node = op.get("node", "server")
        ts = op.get("ts") or _now()

        if op_type == "lww_set":
            self.lww.set(op["key"], op["value"], node, ts)
        elif op_type == "feedback_add":
            fid = op.get("id") or str(uuid.uuid4())
            tag = self.feedback_ids.add(fid, op.get("tag"))
            self.feedback_items[fid] = {
                **op.get("payload", {}),
                "id": fid,
                "tag": tag,
                "ts": ts,
                "node": node,
            }
        elif op_type == "or_add":
            self.feedback_ids.add(op["element"], op.get("tag"))
        elif op_type == "or_remove":
            self.feedback_ids.remove(op["element"])

        self.version += 1
        self.updated_at = _now()
        return {"applied": True, "version": self.version}

    def merge_remote(self, remote_state: dict) -> int:
        merged = 0
        if remote_state.get("lww"):
            self.lww.merge(remote_state["lww"])
            merged += 1
        if remote_state.get("feedback_ids"):
            self.feedback_ids.merge(remote_state["feedback_ids"])
            merged += 1
        for item in remote_state.get("feedback_items", []):
            fid = item.get("id")
            if fid and fid not in self.feedback_items:
                self.feedback_items[fid] = item
                merged += 1
        self.version += 1
        self.updated_at = _now()
        return merged

    def export_state(self) -> dict:
        feedback = [
            self.feedback_items[fid]
            for fid in self.feedback_ids.values()
            if fid in self.feedback_items
        ]
        feedback.sort(key=lambda x: x.get("ts", ""), reverse=True)
        return {
            "workspace_id": self.workspace_id,
            "version": self.version,
            "updated_at": self.updated_at,
            "lww": self.lww.to_dict(),
            "lww_snapshot": self.lww.snapshot(),
            "feedback_ids": self.feedback_ids.to_dict(),
            "feedback_items": feedback,
        }


class CRDTStore:
    """Global in-memory CRDT store keyed by workspace_id."""

    def __init__(self):
        self._docs: dict[int, WorkspaceCRDT] = {}

    def get_or_create(self, workspace_id: int) -> WorkspaceCRDT:
        if workspace_id not in self._docs:
            doc = WorkspaceCRDT(workspace_id)
            doc.lww.set("sync_status", "ready", "server")
            doc.lww.set("offline_capable", True, "server")
            self._docs[workspace_id] = doc
        return self._docs[workspace_id]

    def push_ops(self, workspace_id: int, ops: list[dict], node: str) -> dict:
        doc = self.get_or_create(workspace_id)
        applied = []
        for op in ops:
            op.setdefault("node", node)
            doc.apply_op(op)
            applied.append(op.get("id") or op.get("type"))
        return {
            "workspace_id": workspace_id,
            "applied": len(applied),
            "version": doc.version,
            "state": doc.export_state(),
        }

    def merge_state(self, workspace_id: int, remote_state: dict) -> dict:
        doc = self.get_or_create(workspace_id)
        merged = doc.merge_remote(remote_state)
        return {"workspace_id": workspace_id, "merged_fields": merged, "state": doc.export_state()}

    def get_state(self, workspace_id: int) -> dict:
        return self.get_or_create(workspace_id).export_state()


crdt_store = CRDTStore()