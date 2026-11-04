import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class UserRole(str, enum.Enum):
    STUDENT = "student"
    MODERATOR = "moderator"
    ADMINISTRATOR = "administrator"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True)
    reset_password_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    conversation_memberships = relationship("ConversationMember", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    academic_resources = relationship("AcademicResource", back_populates="uploader")
    forum_posts = relationship("ForumPost", back_populates="author")
    forum_comments = relationship("ForumComment", back_populates="author")
    notifications = relationship("Notification", back_populates="recipient", foreign_keys="Notification.recipient_id", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="user", cascade="all, delete-orphan")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(120), nullable=False, default="")
    display_name = Column(String(120), nullable=True)
    bio = Column(Text, nullable=True, default="")
    program = Column(String(100), nullable=True, default="BS-MS")  # BS-MS, PhD, I-PhD, MSc
    academic_year = Column(String(20), nullable=True, default="1st Year")
    department = Column(String(100), nullable=True, default="General Sciences")
    status_text = Column(String(200), nullable=True, default="")
    avatar_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    banner_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    accent_color = Column(String(20), nullable=True, default="#10b981")
    is_private = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="profile")
    avatar = relationship("FileMetadata", foreign_keys=[avatar_file_id])
    banner = relationship("FileMetadata", foreign_keys=[banner_file_id])

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    email_notifications = Column(Boolean, default=True, nullable=False)
    sound_enabled = Column(Boolean, default=True, nullable=False)
    last_seen_privacy = Column(String(20), default="everyone", nullable=False)  # everyone, friends, nobody
    theme_preference = Column(String(20), default="system", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="settings")
