from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.services.crdt_store import crdt_store

router = APIRouter()

@router.post("/start")
def start_session(workspace_id: int, db: Session = Depends(get_db)):
    """Start a new collaboration session"""
    crdt_store.get_or_create(workspace_id)
    return {
        "session_id": f"session_{workspace_id}",
        "workspace_id": workspace_id,
        "status": "started",
        "phase": 3,
        "offline_capable": True,
        "message": "Session started with CRDT offline-first sync enabled.",
    }

@router.post("/sync")
def sync_offline_changes(
    session_id: str,
    changes: dict = None,
    current_user: User = Depends(get_current_user),
):
    """Sync offline changes (CRDT-based)"""
    workspace_id = 1
    if session_id.startswith("session_"):
        try:
            workspace_id = int(session_id.replace("session_", ""))
        except ValueError:
            pass
    elif session_id.startswith("ws-"):
        parts = session_id.split("-")
        if len(parts) >= 2:
            try:
                workspace_id = int(parts[1])
            except ValueError:
                pass

    ops = []
    if changes:
        for key, value in changes.items():
            ops.append({"type": "lww_set", "key": key, "value": value, "node": current_user.username})

    if ops:
        result = crdt_store.push_ops(workspace_id, ops, current_user.username)
        return {
            "status": "success",
            "message": "Changes synchronized successfully",
            "session_id": session_id,
            **result,
        }
    return {
        "status": "success",
        "message": "No changes to sync",
        "session_id": session_id,
        "state": crdt_store.get_state(workspace_id),
    }

@router.get("/{session_id}")
def get_session(session_id: str):
    """Get session details"""
    return {
        "session_id": session_id,
        "status": "active",
        "participants": [],
        "message": "Session details endpoint - to be expanded"
    }