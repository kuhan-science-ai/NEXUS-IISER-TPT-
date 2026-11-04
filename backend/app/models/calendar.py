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

class EventType(str, enum.Enum):
    LECTURE = "lecture"
    LAB = "lab"
    EXAM = "exam"
    DEADLINE = "deadline"
    PERSONAL = "personal"
    CLUB = "club"
    SEMINAR = "seminar"

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(EventType), default=EventType.PERSONAL, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_all_day = Column(Boolean, default=False, nullable=False)
    location = Column(String(150), nullable=True)
    recurrence_rule = Column(String(100), nullable=True)  # iCal RRULE format for future Google Calendar sync
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="calendar_events")
    course = relationship("Course")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    is_completed = Column(Boolean, default=False, nullable=False)
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high, urgent
    category = Column(String(50), default="study", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="tasks")

class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    content_latex = Column(Text, nullable=False, default="")
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="notes")
    course = relationship("Course")
