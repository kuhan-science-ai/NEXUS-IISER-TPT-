import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class VoteType(int, enum.Enum):
    UPVOTE = 1
    DOWNVOTE = -1

class ForumPost(Base):
    __tablename__ = "forum_posts"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(255), nullable=False, index=True)
    content_latex = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)  # Mathematics, Physics, Chemistry, Biology, General, Research
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_solved = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    author = relationship("User", back_populates="forum_posts")
    comments = relationship("ForumComment", back_populates="post", cascade="all, delete-orphan", order_by="ForumComment.created_at")
    votes = relationship("ForumVote", back_populates="post", cascade="all, delete-orphan")

class ForumComment(Base):
    __tablename__ = "forum_comments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    post_id = Column(String(36), ForeignKey("forum_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_comment_id = Column(String(36), ForeignKey("forum_comments.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    content_latex = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    is_accepted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    post = relationship("ForumPost", back_populates="comments")
    author = relationship("User", back_populates="forum_comments")
    replies = relationship("ForumComment", backref="parent_comment", remote_side=[id])
    votes = relationship("ForumVote", back_populates="comment", cascade="all, delete-orphan")

class ForumVote(Base):
    __tablename__ = "forum_votes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(String(36), ForeignKey("forum_posts.id", ondelete="CASCADE"), nullable=True, index=True)
    comment_id = Column(String(36), ForeignKey("forum_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    vote_type = Column(Integer, nullable=False)  # +1 or -1
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    post = relationship("ForumPost", back_populates="votes")
    comment = relationship("ForumComment", back_populates="votes")
    user = relationship("User")

    __table_args__ = (
        Index("idx_post_vote_unique", "user_id", "post_id", unique=True),
        Index("idx_comment_vote_unique", "user_id", "comment_id", unique=True),
    )

class StudyGroup(Base):
    __tablename__ = "study_groups"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    max_members = Column(Integer, default=20, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    course = relationship("Course", back_populates="study_groups")
    creator = relationship("User")
