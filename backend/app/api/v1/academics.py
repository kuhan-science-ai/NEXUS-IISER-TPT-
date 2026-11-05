from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, desc

from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.file import FileMetadata
from backend.app.models.academic import (
    Course,
    CourseEnrollment,
    AcademicResource,
    ResourceBookmark,
    ResourceRating,
)
from backend.app.models.forum import StudyGroup
from backend.app.services.storage import storage_service, ALLOWED_DOCUMENT_MIMES
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/academics", tags=["Academics & Repository"])

@router.get("/courses")
async def list_courses(
    department: Optional[str] = None,
    semester: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Course).where(Course.is_active == True)
    if department:
        query = query.where(Course.department.ilike(f"%{department}%"))
    if semester:
        query = query.where(Course.semester.ilike(f"%{semester}%"))
    query = query.order_by(Course.code)
    res = await db.execute(query)
    courses = res.scalars().all()
    return courses

@router.post("/courses/{course_id}/enroll")
async def enroll_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify course exists
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = (await db.execute(
        select(CourseEnrollment).where(CourseEnrollment.course_id == course_id, CourseEnrollment.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        return {"message": "Already enrolled in this course"}

    enrollment = CourseEnrollment(course_id=course_id, user_id=current_user.id)
    db.add(enrollment)
    await db.commit()
    return {"message": f"Successfully enrolled in {course.code}"}

@router.get("/resources")
async def list_resources(
    query: Optional[str] = None,
    course_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AcademicResource)
        .options(
            selectinload(AcademicResource.file),
            selectinload(AcademicResource.course),
            selectinload(AcademicResource.uploader).selectinload(User.profile)
        )
    )
    if query:
        stmt = stmt.where(
            or_(
                AcademicResource.title.ilike(f"%{query}%"),
                AcademicResource.description.ilike(f"%{query}%"),
                AcademicResource.subject.ilike(f"%{query}%"),
            )
        )
    if course_id:
        stmt = stmt.where(AcademicResource.course_id == course_id)
    if category:
        stmt = stmt.where(AcademicResource.category == category)

    stmt = stmt.order_by(desc(AcademicResource.created_at)).limit(limit)
    res = await db.execute(stmt)
    resources = res.scalars().all()

    items = []
    for r in resources:
        uploader_name = r.uploader.profile.full_name if (r.uploader and r.uploader.profile) else (r.uploader.username if r.uploader else "Anonymous")
        items.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "category": r.category,
            "subject": r.subject,
            "academic_year": r.academic_year,
            "semester": r.semester,
            "download_count": r.download_count,
            "version": r.version,
            "created_at": r.created_at,
            "course": {"code": r.course.code, "name": r.course.name} if r.course else None,
            "uploader_name": uploader_name,
            "file": {
                "id": r.file.id,
                "filename": r.file.filename,
                "mime_type": r.file.mime_type,
                "size_bytes": r.file.size_bytes,
                "download_url": f"/api/v1/files/{r.file.id}/download"
            } if r.file else None
        })
    return items

@router.post("/resources")
async def upload_academic_resource(
    title: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    course_id: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    academic_year: Optional[str] = Form("2026-2027"),
    semester: Optional[str] = Form("Monsoon"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file,
        category="academics",
        allowed_mimes=ALLOWED_DOCUMENT_MIMES,
        delivery_type="upload",
    )

    file_meta = FileMetadata(
        filename=file.filename or "resource.pdf",
        stored_filename=stored_name,
        file_path=rel_path,
        mime_type=mime,
        size_bytes=size_bytes,
        uploader_id=current_user.id,
        is_public=True,
        file_category="academic",
    )
    db.add(file_meta)
    await db.flush()

    resource = AcademicResource(
        title=title,
        description=description,
        category=category,
        course_id=course_id,
        subject=subject,
        academic_year=academic_year,
        semester=semester,
        file_id=file_meta.id,
        uploader_id=current_user.id,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    return {"message": "Resource successfully uploaded", "resource_id": resource.id}

@router.post("/resources/{resource_id}/bookmark")
async def bookmark_resource(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ResourceBookmark).where(
        ResourceBookmark.resource_id == resource_id,
        ResourceBookmark.user_id == current_user.id
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        action = "removed"
    else:
        bm = ResourceBookmark(resource_id=resource_id, user_id=current_user.id)
        db.add(bm)
        action = "added"
    await db.commit()
    return {"message": f"Bookmark {action}"}

@router.post("/resources/{resource_id}/rate")
async def rate_resource(
    resource_id: str,
    rating: int = Form(..., ge=1, le=5),
    review: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ResourceRating).where(
        ResourceRating.resource_id == resource_id,
        ResourceRating.user_id == current_user.id
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        existing.rating = rating
        existing.review = review
    else:
        new_rating = ResourceRating(resource_id=resource_id, user_id=current_user.id, rating=rating, review=review)
        db.add(new_rating)
    await db.commit()
    return {"message": "Rating recorded"}
