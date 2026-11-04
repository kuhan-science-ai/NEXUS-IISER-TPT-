import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NEXUS - IISER Tirupati Student Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Security
    SECRET_KEY: str = "nexus_super_secret_jwt_key_replace_in_production_iisertirupati_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    # Database
    # Standard PostgreSQL async URL, defaults to SQLite for immediate local dev & testing
    DATABASE_URL: str = "sqlite+aiosqlite:///./nexus.db"
    SYNC_DATABASE_URL: str = "sqlite:///./nexus.db"
    
    # Storage
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage"))
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    
    # Rate Limiting
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300  # 5 minutes

    # Local AI provider used by the orchestration workspace.
    AI_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "gpt-oss:20b"
    AI_MAX_CONCURRENT_REQUESTS: int = 8
    AI_MAX_QUEUED_REQUESTS: int = 512
    AI_QUEUE_TIMEOUT_SECONDS: int = 180

    # Full LaTeX compilation through a locally installed Tectonic executable.
    TECTONIC_PATH: str = "tectonic"
    LATEX_COMPILE_TIMEOUT_SECONDS: int = 45

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
