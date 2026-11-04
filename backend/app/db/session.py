from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, Session
from backend.app.core.config import settings

sqlite_connect_args = {"check_same_thread": False, "timeout": 30.0}

# Async Engine for FastAPI async handlers
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=sqlite_connect_args if "sqlite" in settings.DATABASE_URL else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Sync Engine for Migrations, Seeding and Synchronous Tasks
sync_engine = create_engine(
    settings.SYNC_DATABASE_URL,
    echo=False,
    future=True,
    connect_args=sqlite_connect_args if "sqlite" in settings.SYNC_DATABASE_URL else {}
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
