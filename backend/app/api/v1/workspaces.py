from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse

router = APIRouter()

@router.post("/", response_model=WorkspaceResponse)
def create_workspace(workspace: WorkspaceCreate, db: Session = Depends(get_db)):
    # TODO: Add proper user authentication later
    new_workspace = Workspace(
        name=workspace.name,
        owner_id=1  # Placeholder - will link to authenticated user later
    )
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    return new_workspace