import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # Academic, Cultural, Sports, Science Club, Workshop
    location = Column(String(150), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    organizer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    capacity = Column(Integer, nullable=True)
    image_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organizer = relationship("User")
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")

class EventRegistration(Base):
    __tablename__ = "event_registrations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="registered", nullable=False)  # registered, waitlist, cancelled
    registered_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    event = relationship("Event", back_populates="registrations")
    user = relationship("User")

    __table_args__ = (
        Index("idx_event_reg_unique", "event_id", "user_id", unique=True),
    )

class CampusPulseItem(Base):
    __tablename__ = "campus_pulse_items"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general", nullable=False)  # shoutout, achievement, club, update
    likes_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    author = relationship("User")

class LostFoundItem(Base):
    __tablename__ = "lost_found_items"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(10), nullable=False)  # lost, found
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(150), nullable=False)
    status = Column(String(20), default="open", nullable=False)  # open, claimed, resolved
    contact_info = Column(String(150), nullable=False)
    image_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User")

class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(200), nullable=False)
    organization = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # Internship, Research, Scholarship, Competition, Workshop
    deadline = Column(DateTime(timezone=True), nullable=True, index=True)
    apply_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class DailyQuestion(Base):
    __tablename__ = "daily_questions"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    date = Column(String(10), unique=True, nullable=False, index=True)  # YYYY-MM-DD
    category = Column(String(50), nullable=False)  # Physics, Mathematics, Biology, Chemistry
    question_latex = Column(Text, nullable=False)
    explanation_latex = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False, default='["Option A", "Option B", "Option C", "Option D"]')
    points = Column(Integer, default=10, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    answers = relationship("DailyQuestionAnswer", back_populates="question", cascade="all, delete-orphan", order_by="DailyQuestionAnswer.submitted_at")

class DailyQuestionAnswer(Base):
    __tablename__ = "daily_question_answers"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    question_id = Column(String(36), ForeignKey("daily_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    answer_latex = Column(Text, nullable=False)
    selected_option = Column(Integer, nullable=False, default=0)
    attachment_file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True)
    points_awarded = Column(Integer, nullable=False, default=10)
    submitted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    question = relationship("DailyQuestion", back_populates="answers")
    author = relationship("User")
    attachment = relationship("FileMetadata")
    comments = relationship("DailyQuestionAnswerComment", back_populates="answer", cascade="all, delete-orphan", order_by="DailyQuestionAnswerComment.created_at")

    __table_args__ = (UniqueConstraint("question_id", "user_id", name="uq_daily_question_answer_user"),)

class DailyQuestionAnswerComment(Base):
    __tablename__ = "daily_question_answer_comments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    answer_id = Column(String(36), ForeignKey("daily_question_answers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_comment_id = Column(String(36), ForeignKey("daily_question_answer_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    answer = relationship("DailyQuestionAnswer", back_populates="comments")
    author = relationship("User")


class DailyQuestionProposal(Base):
    __tablename__ = "daily_question_proposals"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    question_latex = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_option = Column(Integer, nullable=False, default=0, server_default="0")
    explanation_latex = Column(Text, nullable=False)
    template_notes = Column(Text, nullable=False, default="")
    animation_notes = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="pending", index=True)
    submitted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    author = relationship("User")
