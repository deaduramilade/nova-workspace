from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter()

@router.post("/start")
def start_session(workspace_id: int, db: Session = Depends(get_db)):
    # Placeholder for session creation
    return {
        "session_id": "sess_placeholder",
        "workspace_id": workspace_id,
        "status": "started",
        "message": "Session started successfully (Phase 1 placeholder)"
    }

@router.get("/{session_id}/join")
def join_session(session_id: str):
    return {
        "session_id": session_id,
        "neko_url": "http://localhost:5210",
        "status": "ready"
    }