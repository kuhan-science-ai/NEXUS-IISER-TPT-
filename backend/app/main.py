from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.db.session import sync_engine, SyncSessionLocal
from backend.app.db.init_db import init_db

# Routers
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.users import router as users_router
from backend.app.api.v1.friends import router as friends_router
from backend.app.api.v1.messages import router as messages_router
from backend.app.api.v1.files import router as files_router
from backend.app.api.v1.academics import router as academics_router
from backend.app.api.v1.forums import router as forums_router
from backend.app.api.v1.campus import router as campus_router
from backend.app.api.v1.ai import router as ai_router
from backend.app.api.v1.latex import router as latex_router
from backend.app.services.ai.provider import ollama_ai_provider
from backend.app.ws.router import router as ws_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and demo seed data on startup
    db = SyncSessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    try:
        yield
    finally:
        await ollama_ai_provider.aclose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local Vite frontend development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(friends_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)
app.include_router(files_router, prefix=settings.API_V1_STR)
app.include_router(academics_router, prefix=settings.API_V1_STR)
app.include_router(forums_router, prefix=settings.API_V1_STR)
app.include_router(campus_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(latex_router, prefix=settings.API_V1_STR)

# Real-time WebSocket Router
app.include_router(ws_router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
