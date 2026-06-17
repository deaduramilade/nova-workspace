"""Workspace-scoped file storage service.

Files are physically stored on disk (volumes/uploads) but metadata is tracked
in the DB with a workspace_id for access control / grouping per organization/group.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.file import UploadedFile
from app.models.user import User
from app.models.workspace import Workspace


UPLOAD_DIR: Path = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _safe_stored_name(original: str) -> str:
    if not original:
        original = "file"
    cleaned = original.replace("/", "_").replace("\\", "_").replace("..", "_").strip()[:80]
    if not cleaned:
        cleaned = "file"
    return f"{uuid.uuid4().hex[:10]}_{cleaned}"


def can_access_workspace(db: Session, workspace_id: int) -> bool:
    """Return True if the workspace exists.

    In this app any authenticated user who knows a workspace id (e.g. via link
    or being added to the team) can participate in its chat/stream. We use the
    same rule for its file storage.
    """
    return db.query(Workspace.id).filter(Workspace.id == workspace_id).first() is not None


async def save_upload(
    db: Session,
    upload: UploadFile,
    *,
    workspace_id: Optional[int],
    uploader: User,
) -> UploadedFile:
    """Persist the uploaded bytes + metadata row. Returns the DB record."""
    if not upload.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if workspace_id is not None and not can_access_workspace(db, workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found")

    stored_name = _safe_stored_name(upload.filename)
    dest = UPLOAD_DIR / stored_name

    size = 0
    try:
        with dest.open("wb") as f:
            while True:
                chunk = await upload.read(1024 * 1024)  # async read from UploadFile
                if not chunk:
                    break
                f.write(chunk)
                size += len(chunk)
    except Exception as exc:
        try:
            if dest.exists():
                dest.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to store uploaded file: {exc}")

    record = UploadedFile(
        id=stored_name,
        workspace_id=workspace_id,
        uploader_id=uploader.id,
        original_filename=upload.filename,
        stored_filename=stored_name,
        content_type=upload.content_type or "application/octet-stream",
        size=size,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_for_workspace(db: Session, workspace_id: int) -> list[UploadedFile]:
    if not can_access_workspace(db, workspace_id):
        return []
    return (
        db.query(UploadedFile)
        .filter(UploadedFile.workspace_id == workspace_id)
        .order_by(UploadedFile.created_at.desc())
        .all()
    )


def get_record(db: Session, stored_name: str) -> Optional[UploadedFile]:
    return db.query(UploadedFile).filter(UploadedFile.id == stored_name).first()


def get_download_path(record: UploadedFile) -> str:
    """Legacy flat path (still works)."""
    return f"/files/download/{record.stored_filename}"


def get_workspace_download_path(record: UploadedFile) -> Optional[str]:
    if record.workspace_id is None:
        return None
    return f"/files/workspace/{record.workspace_id}/download/{record.stored_filename}"

def delete_file(db: Session, file_id: str, uploader: User) -> None:
    """Delete a file by owner. Removes both DB record and physical file.
    
    Args:
        db: Database session
        file_id: The stored filename (UploadedFile.id)
        uploader: Current user (must be the file owner)
        
    Raises:
        HTTPException 404: File not found
        HTTPException 403: User is not the file owner
    """
    record = get_record(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if record.uploader_id != uploader.id:
        raise HTTPException(status_code=403, detail="Only the file owner can delete this file")
    
    # Delete physical file from disk
    try:
        p = UPLOAD_DIR / record.stored_filename
        if p.exists():
            p.unlink()
    except Exception as exc:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to delete file from storage: {exc}"
        )
    
    # Delete database record
    db.delete(record)
    db.commit()

def serialize(record: UploadedFile) -> dict:
    """Shape returned to frontend (frontend will turn paths into usable URLs via apiUrl)."""
    return {
        "id": record.id,
        "workspace_id": record.workspace_id,
        "original_filename": record.original_filename,
        "content_type": record.content_type,
        "size": record.size,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "download_path": get_download_path(record),
        "workspace_download_path": get_workspace_download_path(record),
        "uploader_id": record.uploader_id,
    }
