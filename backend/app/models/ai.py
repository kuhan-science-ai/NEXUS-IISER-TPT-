import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum, ForeignKey, Integer, Index
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class AIMessageRole(str, enum.Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"

class ToolExecutionStatus(str, enum.Enum):
    PENDING_CONFIRMATION = "pending_confirmation"
    APPROVED = "approved"
    REJECTED = "rejected"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(150), nullable=False, default="New Conversation")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.created_at")
    tool_executions = relationship("AIToolExecution", back_populates="conversation", cascade="all, delete-orphan")

class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(AIMessageRole), nullable=False)
    content = Column(Text, nullable=False)
    tool_calls_json = Column(Text, nullable=True)  # JSON string of planned tool invocations
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    conversation = relationship("AIConversation", back_populates="messages")

class AIToolExecution(Base):
    __tablename__ = "ai_tool_executions"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_name = Column(String(100), nullable=False)
    tool_args_json = Column(Text, nullable=False)
    tool_result_json = Column(Text, nullable=True)
    safety_tier = Column(String(30), default="read_only", nullable=False)  # read_only, reversible, destructive, external
    status = Column(Enum(ToolExecutionStatus), default=ToolExecutionStatus.RUNNING, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    conversation = relationship("AIConversation", back_populates="tool_executions")
