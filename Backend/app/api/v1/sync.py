from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.auth import get_current_user
from app.models.user import User
from app.services.crdt_store import crdt_store
from app.services.supervisor_manager import get_overview

router = APIRouter(tags=["sync"])


class SyncPushRequest(BaseModel):
    ops: list[dict] = Field(default_factory=list)
    node: str = "client"
    client_version: int = 0


class SyncMergeRequest(BaseModel):
    state: dict
    node: str = "client"


@router.get("/status")
def phase3_status(current_user: User = Depends(get_current_user)):
    overview = get_overview()
    return {
        "phase": 3,
        "user": current_user.username,
        "role": current_user.role,
        "offline_first": True,
        "crdt": "lww-map + or-set",
        "integrations": overview["integrations"],
    }


@router.get("/{workspace_id}/state")
def get_sync_state(workspace_id: int, current_user: User = Depends(get_current_user)):
    return crdt_store.get_state(workspace_id)


@router.post("/{workspace_id}/push")
def push_sync_ops(
    workspace_id: int,
    body: SyncPushRequest,
    current_user: User = Depends(get_current_user),
):
    node = body.node or current_user.username
    result = crdt_store.push_ops(workspace_id, body.ops, node)
    return {
        **result,
        "client_version": body.client_version,
        "synced_at": result["state"]["updated_at"],
    }


@router.post("/{workspace_id}/merge")
def merge_sync_state(
    workspace_id: int,
    body: SyncMergeRequest,
    current_user: User = Depends(get_current_user),
):
    result = crdt_store.merge_state(workspace_id, body.state)
    return {**result, "node": body.node or current_user.username}


@router.post("/{workspace_id}/delta")
def sync_delta(
    workspace_id: int,
    changes: Optional[dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
):
    """Legacy-compatible delta sync endpoint (architecture.md Phase 3)."""
    ops = []
    if changes:
        for key, value in changes.items():
            ops.append({
                "type": "lww_set",
                "key": key,
                "value": value,
                "node": current_user.username,
            })
    if ops:
        result = crdt_store.push_ops(workspace_id, ops, current_user.username)
        return {"status": "success", "message": "Changes synchronized", **result}
    return {"status": "noop", "state": crdt_store.get_state(workspace_id)}