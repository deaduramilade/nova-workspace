from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
import requests
import re

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.memory_chunk import MemoryChunk
from sqlalchemy.orm import Session

router = APIRouter()

OLLAMA_URL = "http://ollama:11434"  # service name in compose; falls back gracefully
DEFAULT_MODEL = "llama3.2"


class ChatRequest(BaseModel):
    query: str
    persona: Optional[str] = "general"  # general | supervisor | hr | admin | workspace
    room_id: Optional[str] = None
    context: Optional[str] = None  # additional hints
    workspace_id: Optional[int] = None  # for memory queries


def _is_memory_query(query: str) -> bool:
    """
    Detect if this query is asking for memory/workspace intelligence.
    
    Patterns:
    - "memory:" prefix
    - "ask memory" or "query memory"
    - "tell me about", "what about", "when did" (context-dependent)
    - "remember", "recall", "find in memory"
    """
    q = query.lower().strip()
    
    memory_triggers = [
        r"^\s*memory\s*:",
        r"^ask\s+memory",
        r"^query\s+memory",
        r"^search\s+memory",
        r"remember\s+",
        r"recall\s+",
        r"tell\s+me\s+about\s+\w+\s+(from\s+)?(memory|meeting|transcript)",
        r"what\s+about\s+\w+\s+(from\s+)?(memory|meeting|decision)",
        r"when\s+did\s+we\s+(decide|discuss)\s+",
        r"what\s+decisions?\s+(were\s+)?made",
        r"find\s+in\s+memory",
    ]
    
    for pattern in memory_triggers:
        if re.search(pattern, q):
            return True
    
    return False


def _extract_memory_query(query: str) -> str:
    """
    Extract clean query text from memory command.
    Removes prefixes like "memory:" or "ask memory:".
    """
    q = query.strip()
    # Remove common prefixes
    q = re.sub(r"^(memory|ask memory|query memory|search memory|remember)\s*:?\s*", "", q, flags=re.IGNORECASE)
    return q.strip()


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
    db: Session = Depends(get_db),
):
    """Role- and context-aware AI chat. Triggered from the frontend when the user types 'Nova ...' in chat.
    
    Also supports memory queries:
    - "Nova memory: what decisions were made?"
    - "Nova ask memory about project X"
    - "Nova recall when we decided on..."
    """
    persona = body.persona or "general"
    query = (body.query or "").strip()
    workspace_id = body.workspace_id
    
    if not query:
        return {"response": "Hi! How can Nova help?", "from": f"Nova ({persona})"}
    
    # Check if this is a memory query
    if _is_memory_query(query):
        # Extract clean query and handle memory query
        memory_query = _extract_memory_query(query)
        return await _handle_memory_query(
            memory_query=memory_query,
            current_user=current_user,
            workspace_id=workspace_id,
            db=db,
        )
    
    # Regular Nova chat (non-memory)
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


async def _handle_memory_query(
    memory_query: str,
    current_user: User,
    workspace_id: Optional[int],
    db: Session,
) -> dict:
    """
    Handle memory query by calling the memory/query endpoint.
    
    Args:
        memory_query: Cleaned query text
        current_user: Current user
        workspace_id: Workspace to query (optional)
        db: Database session
    
    Returns:
        Response dict with memory query results
    """
    if not memory_query:
        return {
            "response": "Please specify what you'd like to know from workspace memory.",
            "from": "Nova (Memory)",
            "type": "memory",
        }
    
    if not workspace_id:
        return {
            "response": "I need a workspace context to search memory. Please specify workspace_id or ask from within a workspace.",
            "from": "Nova (Memory)",
            "type": "memory",
        }
    
    try:
        from app.services.semantic_search import (
            generate_query_embedding,
            hybrid_search,
        )
        
        # Generate embedding for query
        query_embedding = await generate_query_embedding(memory_query)
        
        # Perform search
        search_results = hybrid_search(
            db=db,
            workspace_id=workspace_id,
            query=memory_query,
            query_embedding=query_embedding,
            current_user=current_user,
            limit=5,
        )
        
        if not search_results:
            return {
                "response": "I couldn't find relevant information in the workspace memory. No matching records found.",
                "from": "Nova (Memory)",
                "type": "memory",
                "sources": [],
            }
        
        # Generate answer from LLM
        sources_text = "\n\n".join([
            f"[{result.chunk.chunk_type.value}] {result.chunk.content[:200]}"
            for result in search_results
        ])
        
        from app.api.v1.memory import _generate_memory_answer
        answer = await _generate_memory_answer(
            user_query=memory_query,
            sources_text=sources_text,
            user_role=current_user.role,
        )
        
        return {
            "response": answer,
            "from": "Nova (Memory)",
            "type": "memory",
            "sources": [
                {
                    "type": result.chunk.chunk_type.value,
                    "preview": result.chunk.content[:150],
                    "similarity": result.similarity,
                }
                for result in search_results
            ],
            "source_count": len(search_results),
        }
    
    except Exception as e:
        return {
            "response": f"Memory query failed: {str(e)}",
            "from": "Nova (Memory)",
            "type": "memory",
            "error": True,
        }


@router.post("/invite")
def invite_agent(workspace_id: int, model: str = "llama3.2"):
    return {
        "agent_id": "agent_placeholder",
        "model": model,
        "workspace_id": workspace_id,
        "status": "invited"
    }