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

class ConversationType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"

class MemberRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    VOICE = "voice"
    SYSTEM = "system"

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(150), nullable=True)  # Name for group chats, null for 1-to-1
    type = Column(Enum(ConversationType), default=ConversationType.DIRECT, nullable=False)
    description = Column(Text, nullable=True)
    avatar_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    banner_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(MemberRole), default=MemberRole.MEMBER, nullable=False)
    last_read_message_id = Column(String(36), nullable=True)
    joined_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", back_populates="conversation_memberships")

    __table_args__ = (
        Index("idx_conv_member_unique", "conversation_id", "user_id", unique=True),
    )

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    content = Column(Text, nullable=False, default="")
    message_type = Column(Enum(MessageType), default=MessageType.TEXT, nullable=False)
    reply_to_id = Column(String(36), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_by_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="messages")
    reply_to = relationship("Message", remote_side=[id])
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    read_receipts = relationship("MessageReadReceipt", back_populates="message", cascade="all, delete-orphan")

class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="CASCADE"), nullable=False)
    attachment_type = Column(String(50), nullable=False, default="document")  # image, document, voice
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    message = relationship("Message", back_populates="attachments")
    file = relationship("FileMetadata")

class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")

    __table_args__ = (
        Index("idx_reaction_unique", "message_id", "user_id", "emoji", unique=True),
    )

class MessageReadReceipt(Base):
    __tablename__ = "message_read_receipts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    message = relationship("Message", back_populates="read_receipts")
    user = relationship("User")

    __table_args__ = (
        Index("idx_read_receipt_unique", "message_id", "user_id", unique=True),
    )
