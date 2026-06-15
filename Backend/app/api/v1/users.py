"""User profile management: self profile, avatar upload (PFP), social account linking."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import (
    AvatarUploadResponse,
    SocialLinkRequest,
    SocialUnlinkRequest,
    UserResponse,
    UserUpdate,
)
from app.services.file_storage import save_upload, UPLOAD_DIR

router = APIRouter()


def _get_user_avatar_path(user: User) -> Optional[str]:
    return user.avatar_url


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's full profile (for settings page etc)."""
    # Ensure linked_accounts is a dict
    if current_user.linked_accounts is None:
        current_user.linked_accounts = {}
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update basic profile fields (display name, bio)."""
    if updates.display_name is not None:
        current_user.display_name = updates.display_name.strip() or None
    if updates.bio is not None:
        current_user.bio = updates.bio.strip() or None

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    if current_user.linked_accounts is None:
        current_user.linked_accounts = {}
    return current_user


@router.post("/me/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a new profile picture. Reuses the general file storage but associates directly to the user."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image file")

    # Save using the existing storage (no workspace scoping for personal avatars)
    # We pass a dummy workspace_id=None
    record = await save_upload(db, file, workspace_id=None, uploader=current_user)

    # Build usable URL (relative path that frontend will resolve with apiUrl)
    avatar_path = f"/files/download/{record.stored_filename}"

    # Update user record (previous avatar URL is left in storage for now; could add cleanup)
    current_user.avatar_url = avatar_path
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return AvatarUploadResponse(avatar_url=avatar_path)


@router.post("/me/link-social", response_model=UserResponse)
def link_social_account(
    link_data: SocialLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Link a social provider account (demo / stub implementation).

    In a real app this would be called after completing an OAuth flow.
    For now we accept provider + external_id (and optional metadata) and store it.
    """
    provider = link_data.provider.lower().strip()
    if not provider or not link_data.external_id:
        raise HTTPException(status_code=400, detail="provider and external_id are required")

    accounts: Dict[str, Any] = dict(current_user.linked_accounts or {})

    accounts[provider] = {
        "external_id": link_data.external_id,
        "linked_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        **(link_data.metadata or {}),
    }

    current_user.linked_accounts = accounts
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    if current_user.linked_accounts is None:
        current_user.linked_accounts = {}
    return current_user


@router.delete("/me/unlink-social", response_model=UserResponse)
def unlink_social_account(
    unlink_data: SocialUnlinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a linked social provider."""
    provider = unlink_data.provider.lower().strip()
    accounts: Dict[str, Any] = dict(current_user.linked_accounts or {})

    if provider in accounts:
        del accounts[provider]
        current_user.linked_accounts = accounts
        db.add(current_user)
        db.commit()
        db.refresh(current_user)

    if current_user.linked_accounts is None:
        current_user.linked_accounts = {}
    return current_user