"""File upload and serving for chat attachments + proper per-workspace/group storage.

Uploads can be tagged with a workspace_id (the primary "group/organization" scoping unit).
Only users who can access a workspace (any authenticated participant today) can list
and manage the files that belong to it. Raw downloads remain unguessable by filename.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.file_storage import (
    UPLOAD_DIR,
    delete_file,
    get_record,
    list_for_workspace,
    save_upload,
    serialize,
)

router = APIRouter(tags=["files"])


# -------------------------------------------------------------------
# Upload (supports optional workspace scoping for org/group isolation)
# -------------------------------------------------------------------
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    workspace_id: Optional[int] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated upload.

    If workspace_id is supplied the file is associated with that workspace's storage
    (visible only via that workspace's file list to its participants).
    """
    record = await save_upload(
        db,
        file,
        workspace_id=workspace_id,
        uploader=current_user,
    )

    # Return both legacy flat path (for old chat links) and a workspace-scoped path when applicable.
    # Frontend should prefer workspace_download_path when it has the context.
    return {
        **serialize(record),
        "filename": record.original_filename,
        "uploaded_by": current_user.username,
    }


# -------------------------------------------------------------------
# Legacy flat downloads (still supported for backward compat with
# previously shared chat attachment links). Names are unguessable.
# -------------------------------------------------------------------
@router.get("/download/{name}")
async def download_file(name: str):
    """Serve a file by its internal stored name (no workspace check)."""
    if not name or ".." in name or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid file name")

    p = UPLOAD_DIR / name
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    display_name = name.split("_", 1)[1] if "_" in name else name
    return FileResponse(
        path=str(p),
        filename=display_name,
        media_type="application/octet-stream",
    )


# -------------------------------------------------------------------
# Workspace-scoped storage API (the real "per group" file library)
# -------------------------------------------------------------------
@router.get("/workspace/{workspace_id}/list")
def list_workspace_files(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all files that belong to this workspace.

    This is the primary way the UI builds the "Storage" view that is isolated
    per workspace / team / organization.
    """
    files = list_for_workspace(db, workspace_id)
    return {
        "workspace_id": workspace_id,
        "files": [serialize(f) for f in files],
    }


@router.get("/workspace/{workspace_id}/download/{name}")
def download_workspace_file(
    workspace_id: int,
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated workspace-scoped download.

    The workspace_id in the path makes the intent explicit. We still verify
    that the file record actually belongs to the workspace.
    """
    record = get_record(db, name)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if record.workspace_id != workspace_id:
        # Do not leak existence across workspaces
        raise HTTPException(status_code=404, detail="File not found")

    # Access is granted to any authenticated user who reached this far
    # (consistent with workspace stream / chat participation rules).
    p = UPLOAD_DIR / record.stored_filename
    if not p.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    display_name = record.original_filename
    return FileResponse(
        path=str(p),
        filename=display_name,
        media_type=record.content_type or "application/octet-stream",
    )


# -------------------------------------------------------------------
# Lightweight debug / admin (still requires auth)
# -------------------------------------------------------------------
@router.get("/list")
def list_recent_uploads(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Global recent list (debug only – real usage goes through workspace lists)."""
    files = []
    for p in sorted(UPLOAD_DIR.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True)[:30]:
        if p.is_file():
            rec = get_record(db, p.name)
            files.append({
                "id": p.name,
                "size": p.stat().st_size,
                "download_path": f"/files/download/{p.name}",
                "workspace_id": rec.workspace_id if rec else None,
            })
    return {"uploads": files, "dir": str(UPLOAD_DIR)}


# -------------------------------------------------------------------
# Delete file (by owner only)
# -------------------------------------------------------------------
@router.delete("/workspace/{workspace_id}/{file_id}")
def delete_workspace_file(
    workspace_id: int,
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a file from workspace storage (owner only).
    
    Only the user who uploaded the file can delete it.
    Admin users can also delete any file in their workspace.
    """
    record = get_record(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if record.workspace_id != workspace_id:
        # Do not leak existence across workspaces
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check authorization: must be owner or admin
    if record.uploader_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the file owner can delete this file")
    
    delete_file(db, file_id, current_user)
    
    return {
        "status": "deleted",
        "file_id": file_id,
        "original_filename": record.original_filename,
    }
