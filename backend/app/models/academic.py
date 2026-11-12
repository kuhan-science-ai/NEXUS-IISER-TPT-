import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, Index, BigInteger
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)  # e.g. BIO111, CHM121, PHY201, MTH311
    name = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)  # Biology, Chemistry, Physics, Mathematics, Earth & Climate
    description = Column(Text, nullable=True)
    semester = Column(String(20), nullable=False)  # Monsoon, Spring
    academic_year = Column(String(20), nullable=False)  # 2026-2027
    faculty_name = Column(String(150), nullable=True)
    credits = Column(Integer, default=3, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan")
    resources = relationship("AcademicResource", back_populates="course", cascade="all, delete-orphan")
    study_groups = relationship("StudyGroup", back_populates="course", cascade="all, delete-orphan")

class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="student", nullable=False)  # student, ta, instructor
    enrolled_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    course = relationship("Course", back_populates="enrollments")
    user = relationship("User")

    __table_args__ = (
        Index("idx_enrollment_unique", "course_id", "user_id", unique=True),
    )

class AcademicResource(Base):
    __tablename__ = "academic_resources"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(50), nullable=False)  # Lecture Notes, Exam Paper, Lab Manual, Reference Book, Assignment Solution
    subject = Column(String(100), nullable=True)
    subject_code = Column(String(40), nullable=True)
    publisher_name = Column(String(120), nullable=True)
    pages = Column(Integer, nullable=False, default=1)
    size_bytes = Column(BigInteger, nullable=False, default=0)
    academic_year = Column(String(20), nullable=True)
    semester = Column(String(20), nullable=True)
    file_id = Column(String(36), ForeignKey("file_metadata.id", ondelete="RESTRICT"), nullable=False)
    uploader_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    download_count = Column(Integer, default=0, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    course = relationship("Course", back_populates="resources")
    file = relationship("FileMetadata")
    uploader = relationship("User", back_populates="academic_resources")
    bookmarks = relationship("ResourceBookmark", back_populates="resource", cascade="all, delete-orphan")
    ratings = relationship("ResourceRating", back_populates="resource", cascade="all, delete-orphan")

class ResourceBookmark(Base):
    __tablename__ = "resource_bookmarks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("academic_resources.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    resource = relationship("AcademicResource", back_populates="bookmarks")
    user = relationship("User")

    __table_args__ = (
        Index("idx_resource_bookmark_unique", "resource_id", "user_id", unique=True),
    )

class ResourceView(Base):
    __tablename__ = "resource_views"

    resource_id = Column(String(36), ForeignKey("academic_resources.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    viewed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class ResourceRating(Base):
    __tablename__ = "resource_ratings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("academic_resources.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 to 5
    review = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    resource = relationship("AcademicResource", back_populates="ratings")
    user = relationship("User")

    __table_args__ = (
        Index("idx_resource_rating_unique", "resource_id", "user_id", unique=True),
    )
