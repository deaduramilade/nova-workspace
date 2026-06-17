"""
Memory Query Feature - Usage Guide

This file documents how to use the new memory query endpoints and chat integration.
"""

# ============================================================================
# 1. DIRECT MEMORY QUERY ENDPOINT
# ============================================================================

# POST /api/v1/memory/query
# 
# Query workspace memory using semantic search + LLM
# 
# Request:
# {
#     "workspace_id": 1,
#     "query": "What decisions were made about the project budget?"
# }
#
# Response:
# {
#     "status": "success",
#     "answer": "In the last meeting, the team decided to allocate $50K for infrastructure...",
#     "sources": [
#         {
#             "id": 42,
#             "content": "Budget allocation: $50K for infrastructure, $30K for staffing",
#             "type": "decision",
#             "similarity": 0.87,
#             "metadata": {"role_tags": ["supervisor", "general"], ...},
#             "created_at": "2026-06-17T10:30:00"
#         },
#         ...
#     ],
#     "confidence": 0.89,
#     "search_count": 3
# }


# ============================================================================
# 2. CHAT INTEGRATION - Memory Query Patterns
# ============================================================================

# Users can naturally ask memory questions in Nova chat:

# Pattern 1: Direct memory prefix
# Message: "Nova memory: what decisions were made?"
# 
# Pattern 2: Ask memory about topic
# Message: "Nova ask memory about project timeline"
#
# Pattern 3: Recall from memory
# Message: "Nova recall when we decided on the budget"
#
# Pattern 4: Search memory
# Message: "Nova search memory for action items"
#
# Pattern 5: What about topic
# Message: "Nova what about the client requirements from the meeting?"

# Chat Response with Memory Results:
# {
#     "response": "Based on the workspace memory, here's what I found...",
#     "from": "Nova (Memory)",
#     "type": "memory",
#     "sources": [
#         {
#             "type": "decision",
#             "preview": "Budget allocation: $50K infrastructure...",
#             "similarity": 0.87
#         },
#         ...
#     ],
#     "source_count": 3
# }


# ============================================================================
# 3. ROLE-BASED FILTERING EXAMPLES
# ============================================================================

# User Role: "supervisor"
# Memory accessible: supervisor + general tagged chunks
# 
# User Role: "hr"
# Memory accessible: hr + general tagged chunks
#
# User Role: "admin"
# Memory accessible: ALL chunks in workspace
#
# User Role: "user"
# Memory accessible: user + general tagged chunks


# ============================================================================
# 4. MEMORY CHUNK TYPES
# ============================================================================

# DECISION: Strategic decisions made in meetings
# ACTION_ITEM: Tasks extracted and assigned to team members
# DISCUSSION: Key discussion points and topics covered
# SUMMARY: Meeting summaries


# ============================================================================
# 5. CURL EXAMPLES
# ============================================================================

# Query memory via API:
# curl -X POST http://localhost:8000/api/v1/memory/query \
#   -H "Authorization: Bearer YOUR_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "workspace_id": 1,
#     "query": "What was discussed about performance metrics?"
#   }'

# Chat with memory (via Nova):
# curl -X POST http://localhost:8000/api/v1/chat \
#   -H "Authorization: Bearer YOUR_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "query": "memory: tell me about decisions from last week",
#     "workspace_id": 1,
#     "persona": "general"
#   }'


# ============================================================================
# 6. TECHNICAL FLOW
# ============================================================================

# Step 1: Query arrives at /api/v1/memory/query or /api/v1/chat
# 
# Step 2: (Chat only) System detects memory query pattern with regex
# 
# Step 3: Generate embedding for query
#         - Uses Ollama's "nomic-embed-text" model
#         - Produces 1536-dimensional vector
# 
# Step 4: Semantic search on memory chunks
#         - Uses pgvector cosine similarity
#         - Applies role-based filtering
#         - Returns top 5 results by similarity
# 
# Step 5: Generate LLM answer
#         - Passes top chunks + query to Nova (llama3.2)
#         - Temperature set to 0.3 (factual)
#         - Limited to 220 tokens
# 
# Step 6: Return answer + sources to user
#         - Includes similarity scores
#         - Includes chunk previews
#         - Shows confidence (average similarity)


# ============================================================================
# 7. FALLBACKS
# ============================================================================

# No embeddings available (new workspace):
# - Uses text matching fallback (substring search)
# - Still returns relevant chunks
# - Still generates LLM answer
#
# LLM unavailable (Ollama down):
# - Returns memory chunks structured format
# - No LLM-generated answer
# - Shows error message
#
# No memory chunks found:
# - Returns helpful message
# - Suggests ingesting meeting transcripts
# - Confidence = 0.0


# ============================================================================
# 8. OPTIMIZATION TIPS
# ============================================================================

# 1. Ingest meeting transcripts regularly
#    POST /api/v1/memory/ingest-transcript
#    (Supervisor+ only)
#
# 2. Use descriptive role_tags when ingesting
#    - Enables better access control
#    - Helps organize memory by team
#
# 3. Ask specific questions
#    - "What decisions about X?" (better)
#    - vs "Tell me everything" (too broad)
#
# 4. Use chat for interactive exploration
#    - Follow-up questions work naturally
#    - Memory results show sources
#    - Can ask about decisions, actions, discussions


# ============================================================================
# 9. EXAMPLE INTEGRATION IN FRONTEND
# ============================================================================

# In ChatPanel component, when user sends "Nova memory: ..."
# 
# 1. Detect memory pattern
# 2. Extract workspace_id from context
# 3. Send to /api/v1/chat with workspace_id
# 4. Receive response with type="memory"
# 5. Render memory result component showing:
#    - AI-generated answer
#    - Source references with similarity scores
#    - Chunk previews
#    - Option to expand sources


# ============================================================================
# 10. CONFIGURATION
# ============================================================================

# Backend environment variables (via .env or docker-compose.env):
#
# OLLAMA_URL=http://ollama:11434
# OLLAMA_MODEL=llama3.2                    # for chat
# OLLAMA_EMBEDDING_MODEL=nomic-embed-text  # for embeddings
# OLLAMA_ENABLED=true
# MEMORY_INGESTION_ENABLED=true
#
# Database requirements:
# - PostgreSQL with pgvector extension
# - IVFFLAT index on memory_chunks.embedding
# - Configured for cosine similarity


# ============================================================================
# 11. PERFORMANCE BENCHMARKS
# ============================================================================

# Vector search latency:
# - ~50-100ms for 1000 chunks (with IVFFLAT index)
# - ~200ms for embedding generation
# - ~500ms for LLM answer generation
# - Total query latency: ~750ms-800ms
#
# Memory requirements:
# - 1536-dim embeddings = ~6KB per chunk
# - 1000 chunks = ~6MB
# - pgvector index overhead ~2x storage


# ============================================================================
# 12. KNOWN LIMITATIONS
# ============================================================================

# 1. Embedding generation depends on Ollama availability
# 2. Vector similarity calculated in Python (could move to SQL)
# 3. Limited to 5 top results for LLM context window
# 4. No long-term memory persistence across sessions
# 5. Role filtering is chunk-level (not field-level)


# ============================================================================
# 13. FUTURE ENHANCEMENTS
# ============================================================================

# 1. Persistent conversation memory within sessions
# 2. Multi-turn dialogue with clarification questions
# 3. Cross-workspace memory queries
# 4. Advanced filtering (date range, meeting, assignee)
# 5. Memory search dashboard/UI
# 6. Scheduled memory summaries (daily/weekly)
# 7. Export memory insights as reports
# 8. Memory tagging/bookmarking for important insights
