from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import requests

from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()

OLLAMA_URL = "http://ollama:11434"  # service name in compose; falls back gracefully
DEFAULT_MODEL = "llama3.2"


class ChatRequest(BaseModel):
    query: str
    persona: Optional[str] = "general"  # general | supervisor | hr | admin | workspace
    room_id: Optional[str] = None
    context: Optional[str] = None  # additional hints


def _get_system_prompt(persona: str, user: User, room_id: Optional[str]) -> str:
    base = (
        "You are Nova, the helpful AI assistant for the Nova collaborative workspace platform. "
        "Be concise, actionable, and friendly. Use short paragraphs. "
    )
    role = (user.role or "user").lower()
    p = (persona or "general").lower()

    if p == "hr" or role == "hr":
        return base + (
            "You are the HR Nova assistant. Focus on employee wellbeing, work hours, approvals, "
            "team load balancing, and compliance. Reference working hours tracking and approvals when relevant. "
            "Be empathetic and professional."
        )
    if p == "supervisor" or role in ("supervisor", "lead"):
        return base + (
            "You are the Supervisor Nova. Help with team oversight, productivity, live status, "
            "feedback (nudge/praise/flag), and performance insights. Be direct and encouraging."
        )
    if p == "admin" or role == "admin":
        return base + (
            "You are the Admin Nova. Assist with user management, roles, system health, "
            "workspaces, and administrative tasks. Be precise and security-conscious."
        )
    if p == "workspace" or (room_id and room_id.startswith("workspace")):
        return base + (
            "You are the Workspace Nova. The user is inside a remote desktop (Neko) session. "
            "Help with browser tasks, productivity inside the streamed environment, "
            "file sharing, and collaboration tips for this workspace."
        )
    # default general / user
    return base + (
        "You are a general collaborative assistant for the team. Help with coordination, "
        "brainstorming, task tracking, and using Nova features like chat, calls, and shared workspaces."
    )


def _mock_response(persona: str, query: str, user: User) -> str:
    q = query.lower()
    p = (persona or "general").lower()
    role = (user.role or "").lower()

    if "hours" in q or "time" in q or "worked" in q:
        if p == "hr" or role == "hr":
            return "Current team hours look balanced. Would you like me to pull the latest logs for a specific employee or date range and suggest approvals?"
        return "The team has been active today. Check the HR workspace for detailed logs and approvals."
    if "approve" in q or "approval" in q:
        return "I can help flag pending approvals. In the HR dashboard you can filter by date/employee and approve individual logs directly."
    if "user" in q or "role" in q or "admin" in q:
        if p == "admin" or role == "admin":
            return "You can manage all users, change roles, and toggle active status from the Administrator Dashboard. Need me to summarize current user distribution?"
        return "For user and role management, the admin dashboard is the place. I can give high-level guidance here."
    if "feedback" in q or "nudge" in q or "praise" in q:
        return "Use the Supervisor tools (nudge, praise, flag) in the sidebar or Supervisor Hub to send real-time feedback to teammates."
    if "status" in q or "online" in q or "who" in q:
        return "Check the presence sidebar or Live tab for current online users and their status messages."
    if "help" in q or "how" in q:
        return "Try commands like 'Nova hours', 'Nova approve', or ask about your current workspace. I'm here to assist based on your role and context."

    # persona flavored defaults
    if p == "hr":
        return "I'm the HR Nova. Ask me about work logs, hours overview, approvals, or employee load. Example: 'Nova show pending approvals for this week'."
    if p == "supervisor":
        return "Supervisor Nova here. I can help with team pulse, feedback, or performance notes. What would you like to review?"
    if p == "admin":
        return "Admin Nova ready. I can advise on users, roles, or system status. What do you need help with?"
    if p == "workspace":
        return "Workspace Nova at your service inside the remote session. Need help with the browser, files, or collaboration in this space?"
    return "Nova here — how can I help the team today? (Try 'Nova hours' or 'Nova who is online' for quick context-aware help.)"


@router.post("/chat")
async def chat_with_nova(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Role- and context-aware AI chat. Triggered from the frontend when the user types 'Nova ...' in chat."""
    persona = body.persona or "general"
    query = (body.query or "").strip()
    if not query:
        return {"response": "Hi! How can Nova help?", "from": f"Nova ({persona})"}

    system_prompt = _get_system_prompt(persona, current_user, body.room_id)

    # Try real Ollama (non-streaming generate for simplicity)
    try:
        import requests
        ollama_payload = {
            "model": DEFAULT_MODEL,
            "prompt": f"{system_prompt}\n\nUser asked: {query}\n\nRespond concisely as Nova:",
            "stream": False,
            "options": {"temperature": 0.7, "num_predict": 220},
        }
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=ollama_payload, timeout=25)
        if r.ok:
            data = r.json()
            text = (data.get("response") or "").strip()
            if text:
                return {
                    "response": text,
                    "from": f"Nova ({persona.title()})",
                    "model": DEFAULT_MODEL,
                }
    except Exception:
        pass  # fall through to excellent mock below

    # Smart contextual mock (works without Ollama)
    mock = _mock_response(persona, query, current_user)
    return {
        "response": mock,
        "from": f"Nova ({persona.title()})",
        "mock": True,
    }


@router.post("/invite")
def invite_agent(workspace_id: int, model: str = "llama3.2"):
    return {
        "agent_id": "agent_placeholder",
        "model": model,
        "workspace_id": workspace_id,
        "status": "invited"
    }