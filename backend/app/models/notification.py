import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class NotificationType(str, enum.Enum):
    NEW_MESSAGE = "new_message"
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPT = "friend_accept"
    GROUP_INVITE = "group_invite"
    FORUM_REPLY = "forum_reply"
    ACCEPTED_ANSWER = "accepted_answer"
    ACADEMIC_UPLOAD = "academic_upload"
    COURSE_ANNOUNCEMENT = "course_announcement"
    EVENT_REMINDER = "event_reminder"
    ASSIGNMENT_DEADLINE = "assignment_deadline"
    SYSTEM_ANNOUNCEMENT = "system_announcement"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    recipient_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    recipient = relationship("User", back_populates="notifications", foreign_keys=[recipient_id])
    actor = relationship("User", foreign_keys=[actor_id])
