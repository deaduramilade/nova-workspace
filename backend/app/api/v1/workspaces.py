from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.workspace import Workspace
from app.models.user import User

router = APIRouter()

@router.post("/")
def create_workspace(name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
def list_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspaces = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
    return workspaces