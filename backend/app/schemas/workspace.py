from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    status: str
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True