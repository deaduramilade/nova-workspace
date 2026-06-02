from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.core.config import settings
from app.api.v1.auth import router as auth_router
from app.api.v1.workspaces import router as workspaces_router
from app.api.v1.sessions import router as sessions_router

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Nova Workspace",
    description="AI-native collaborative browser workspace",
    version="0.1.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(workspaces_router, prefix="/api/v1/workspaces", tags=["Workspaces"])
app.include_router(sessions_router, prefix="/api/v1/sessions", tags=["Sessions"])

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "Nova Backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)