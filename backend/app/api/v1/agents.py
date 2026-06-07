from fastapi import APIRouter

router = APIRouter()

@router.post("/invite")
def invite_agent(workspace_id: int, model: str = "llama3.2"):
    return {
        "agent_id": "agent_placeholder",
        "model": model,
        "workspace_id": workspace_id,
        "status": "invited"
    }