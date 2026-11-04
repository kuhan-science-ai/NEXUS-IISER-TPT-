import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, BigInteger
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class FileMetadata(Base):
    __tablename__ = "file_metadata"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), unique=True, nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    uploader_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    file_category = Column(String(50), nullable=False, default="general")  # avatar, banner, chat_attachment, academic, doc
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
