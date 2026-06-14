"""File upload and serving for chat attachments, workspace shares, and call file sharing."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(tags=["files"])

UPLOAD_DIR: Path = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _safe_filename(original: str) -> str:
    """Create a reasonably safe storage name with uuid prefix."""
    if not original:
        original = "file"
    # Very basic sanitization; avoid path traversal and keep it short
    cleaned = (
        original.replace("/", "_")
        .replace("\\", "_")
        .replace("..", "_")
        .strip()
    )[:80]
    if not cleaned:
        cleaned = "file"
    prefix = uuid.uuid4().hex[:10]
    return f"{prefix}_{cleaned}"


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Authenticated multipart upload. Returns metadata + download_path for use in attachments."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    safe_name = _safe_filename(file.filename)
    dest = UPLOAD_DIR / safe_name

    # Stream write to support larger files without loading fully in memory
    size = 0
    try:
        with dest.open("wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MiB chunks
                if not chunk:
                    break
                f.write(chunk)
                size += len(chunk)
    except Exception as exc:
        # Cleanup partial on failure
        try:
            if dest.exists():
                dest.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to store file: {exc}")

    content_type = file.content_type or "application/octet-stream"

    return {
        "id": safe_name,
        "filename": file.filename,
        "download_path": f"/files/download/{safe_name}",
        "size": size,
        "content_type": content_type,
        "uploaded_by": current_user.username,
    }


@router.get("/download/{name}")
async def download_file(name: str):
    """Serve stored file by its stored name. Filenames are unguessable; no extra auth for direct links."""
    if not name or ".." in name or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid file name")

    p = UPLOAD_DIR / name
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Use original-ish display name by stripping the uuid_ prefix for download attr if possible
    display_name = name.split("_", 1)[1] if "_" in name else name

    return FileResponse(
        path=str(p),
        filename=display_name,
        media_type="application/octet-stream",
    )


@router.get("/list")
async def list_recent_uploads(current_user: User = Depends(get_current_user)):
    """Simple listing for debugging / admin (not used in UI yet)."""
    files = []
    for p in sorted(UPLOAD_DIR.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True)[:50]:
        if p.is_file():
            files.append({
                "id": p.name,
                "size": p.stat().st_size,
                "download_path": f"/files/download/{p.name}",
            })
    return {"uploads": files, "dir": str(UPLOAD_DIR)}
