import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class FriendRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id_1 = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id_2 = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id_1", "user_id_2", name="uq_friendship_pair"),
    )

class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sender_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(FriendRequestStatus), default=FriendRequestStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("sender_id", "receiver_id", name="uq_friend_request_pair"),
    )

class BlockedUser(Base):
    __tablename__ = "blocked_users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    blocker_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block_pair"),
    )
