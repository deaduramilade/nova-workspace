from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.user import UserResponse  # Will expand later

router = APIRouter()

@router.post("/")
def create_workspace(name: str, current_user: User = None, db: Session = Depends(get_db)):
    """Create a new workspace"""
    if not current_user:
        # TODO: Add proper authentication dependency later
        raise HTTPException(status_code=401, detail="Authentication required")
    
    new_workspace = Workspace(
        name=name,
        owner_id=current_user.id,
        is_ephemeral=True
    )
    
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    
    return {"message": "Workspace created successfully", "workspace_id": new_workspace.id}

@router.get("/")
def list_workspaces(current_user: User = None, db: Session = Depends(get_db)):
    """List user's workspaces"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    workspaces = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
    return workspaces