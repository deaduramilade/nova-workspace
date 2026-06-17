"""
Semantic Search Service

Performs vector-based semantic search on memory chunks using pgvector.
Retrieves relevant chunks based on query embeddings and applies role-based filtering.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
import ollama

from app.core.config import settings
from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.user import User


class SemanticSearchResult:
    """Result from semantic search."""
    
    def __init__(self, chunk: MemoryChunk, similarity: float):
        self.chunk = chunk
        self.similarity = similarity
        self.relevance_score = similarity
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.chunk.id,
            "content": self.chunk.content,
            "type": self.chunk.chunk_type.value,
            "similarity": self.similarity,
            "metadata": self.chunk.metadata,
            "created_at": self.chunk.created_at.isoformat() if self.chunk.created_at else None,
        }


async def generate_query_embedding(query: str) -> Optional[List[float]]:
    """
    Generate embedding for user query.
    
    Uses Ollama with embedding model (nomic-embed-text recommended).
    Falls back gracefully if unavailable.
    
    Args:
        query: User query string
    
    Returns:
        Embedding vector or None if failed
    """
    if not settings.OLLAMA_ENABLED:
        return None
    
    try:
        client = ollama.Client(host=settings.OLLAMA_URL)
        # Use embedding endpoint with nomic-embed-text model
        # nomic-embed-text produces 768-dim embeddings
        response = client.embeddings(
            model="nomic-embed-text",
            prompt=query,
        )
        
        if response and "embedding" in response:
            embedding = response["embedding"]
            # Normalize to 1536 dimensions if needed (pad with zeros)
            if len(embedding) < 1536:
                embedding = embedding + [0.0] * (1536 - len(embedding))
            elif len(embedding) > 1536:
                embedding = embedding[:1536]
            return embedding
        
        return None
    
    except Exception as e:
        print(f"[WARN] Embedding generation failed: {e}")
        return None


def semantic_search(
    db: Session,
    workspace_id: int,
    query_embedding: List[float],
    current_user: User,
    limit: int = 5,
    similarity_threshold: float = 0.3,
    chunk_types: Optional[List[ChunkType]] = None,
) -> List[SemanticSearchResult]:
    """
    Perform semantic search on memory chunks using vector similarity.
    
    Applies role-based filtering: user can only see chunks with role_tags
    that include their role or that are tagged as "general".
    
    Args:
        db: Database session
        workspace_id: Workspace to search in
        query_embedding: Query vector (1536 dimensions)
        current_user: Current user (for role-based filtering)
        limit: Max results to return
        similarity_threshold: Minimum similarity score (0-1)
        chunk_types: Optional filter by chunk types
    
    Returns:
        List of SemanticSearchResult objects sorted by relevance
    """
    if not query_embedding:
        return []
    
    try:
        # Start with workspace filter
        query = db.query(MemoryChunk).filter(
            MemoryChunk.workspace_id == workspace_id,
            MemoryChunk.embedding.isnot(None),
        )
        
        # Filter by chunk type if specified
        if chunk_types:
            query = query.filter(MemoryChunk.chunk_type.in_(chunk_types))
        
        # Fetch all chunks (we'll do similarity filtering in Python)
        # In production, use SQL ordering for better performance:
        # ORDER BY embedding <-> query_embedding LIMIT limit
        all_chunks = query.all()
        
        # Calculate similarity scores and filter by threshold
        results = []
        for chunk in all_chunks:
            if not chunk.embedding:
                continue
            
            # Check role-based access
            if not _can_access_chunk(current_user, chunk):
                continue
            
            # Calculate cosine similarity
            similarity = _cosine_similarity(query_embedding, chunk.embedding)
            
            if similarity >= similarity_threshold:
                results.append(SemanticSearchResult(chunk, similarity))
        
        # Sort by similarity (descending) and return top results
        results.sort(key=lambda x: x.similarity, reverse=True)
        return results[:limit]
    
    except Exception as e:
        print(f"[ERROR] Semantic search failed: {e}")
        return []


def _can_access_chunk(user: User, chunk: MemoryChunk) -> bool:
    """
    Check if user has access to this chunk based on role tags.
    
    Access granted if:
    - Chunk has no role tags (unrestricted)
    - Chunk's role_tags include "general"
    - Chunk's role_tags include user's role
    - User is admin
    
    Args:
        user: User object
        chunk: MemoryChunk object
    
    Returns:
        True if user can access this chunk
    """
    if user.role == "admin":
        return True
    
    role_tags = chunk.metadata.get("role_tags", []) if chunk.metadata else []
    if not role_tags:
        return True
    
    if "general" in role_tags:
        return True
    
    if user.role in role_tags:
        return True
    
    return False


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
    
    Returns:
        Similarity score between 0 and 1
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    
    import math
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)


def hybrid_search(
    db: Session,
    workspace_id: int,
    query: str,
    query_embedding: Optional[List[float]],
    current_user: User,
    limit: int = 5,
) -> List[SemanticSearchResult]:
    """
    Perform hybrid search combining semantic and metadata-based retrieval.
    
    Falls back to metadata search if embedding unavailable.
    
    Args:
        db: Database session
        workspace_id: Workspace to search in
        query: Query string (for metadata fallback)
        query_embedding: Query embedding (optional)
        current_user: Current user
        limit: Max results
    
    Returns:
        List of SemanticSearchResult objects
    """
    if query_embedding:
        # Use semantic search if embedding available
        return semantic_search(
            db=db,
            workspace_id=workspace_id,
            query_embedding=query_embedding,
            current_user=current_user,
            limit=limit,
        )
    else:
        # Fallback to simple metadata search
        return _metadata_search(db, workspace_id, query, current_user, limit)


def _metadata_search(
    db: Session,
    workspace_id: int,
    query: str,
    current_user: User,
    limit: int = 5,
) -> List[SemanticSearchResult]:
    """
    Fallback search using content matching (not semantic).
    
    Args:
        db: Database session
        workspace_id: Workspace to search in
        query: Query string
        current_user: Current user
        limit: Max results
    
    Returns:
        List of SemanticSearchResult objects (with similarity = 1.0 for matches)
    """
    query_lower = query.lower()
    
    chunks = db.query(MemoryChunk).filter(
        MemoryChunk.workspace_id == workspace_id,
    ).all()
    
    results = []
    for chunk in chunks:
        if not _can_access_chunk(current_user, chunk):
            continue
        
        # Simple substring matching
        if query_lower in chunk.content.lower():
            # Use 1.0 as default similarity for text matches
            results.append(SemanticSearchResult(chunk, 1.0))
    
    return results[:limit]
