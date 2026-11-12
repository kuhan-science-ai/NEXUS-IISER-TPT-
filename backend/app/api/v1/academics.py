from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, desc, update, delete
from datetime import datetime, timezone

from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.file import FileMetadata
from backend.app.models.academic import (
    Course,
    CourseEnrollment,
    AcademicResource,
    ResourceBookmark,
    ResourceRating,
    ResourceView,
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
    limit: int = Query(300, ge=1, le=300),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AcademicResource)
        .options(
            selectinload(AcademicResource.file),
            selectinload(AcademicResource.course),
            selectinload(AcademicResource.uploader).selectinload(User.profile),
            selectinload(AcademicResource.bookmarks),
        )
    )
    if query:
        stmt = stmt.where(
            or_(
                AcademicResource.title.ilike(f"%{query}%"),
                AcademicResource.description.ilike(f"%{query}%"),
                AcademicResource.subject.ilike(f"%{query}%"),
                AcademicResource.subject_code.ilike(f"%{query}%"),
                AcademicResource.publisher_name.ilike(f"%{query}%"),
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
            "subject_code": r.subject_code or r.subject or "",
            "publisher_name": r.publisher_name or uploader_name,
            "pages": r.pages,
            "size_bytes": r.size_bytes or (r.file.size_bytes if r.file else 0),
            "is_saved": any(bookmark.user_id == current_user.id for bookmark in r.bookmarks),
            "uploader_id": r.uploader_id,
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
    category: str = Form("Lecture Notes"),
    subject_code: str = Form(""),
    publisher_name: str = Form(""),
    pages: int = Form(..., ge=1, le=100000),
    description: Optional[str] = Form(None),
    course_id: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    academic_year: Optional[str] = Form("2026-2027"),
    semester: Optional[str] = Form("Monsoon"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not title.strip() or len(title.strip()) > 200 or not subject_code.strip() or len(subject_code.strip()) > 40 or not publisher_name.strip() or len(publisher_name.strip()) > 120:
        raise HTTPException(status_code=400, detail="Title, subject code, and publisher name are required")
    file.file.seek(0)
    if file.content_type != "application/pdf" or not (await file.read(5)).startswith(b"%PDF-"):
        file.file.seek(0)
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF")
    file.file.seek(0)
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file,
        category="academics",
        allowed_mimes={"application/pdf"},
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
        subject_code=subject_code.strip()[:40],
        publisher_name=publisher_name.strip()[:120],
        pages=pages,
        size_bytes=size_bytes,
        academic_year=academic_year,
        semester=semester,
        file_id=file_meta.id,
        uploader_id=current_user.id,
    )
    db.add(resource)
    await db.flush()
    db.add(ResourceBookmark(resource_id=resource.id, user_id=current_user.id))
    await db.commit()
    await db.refresh(resource)

    return {"message": "Resource successfully uploaded", "id": resource.id, "resource_id": resource.id, "title": resource.title}


async def academic_resources_for_user(db: AsyncSession, user_id: str, collection: str = "all"):
    stmt = select(AcademicResource).options(selectinload(AcademicResource.file), selectinload(AcademicResource.course), selectinload(AcademicResource.uploader).selectinload(User.profile), selectinload(AcademicResource.bookmarks))
    if collection == "mine":
        stmt = stmt.where(AcademicResource.uploader_id == user_id)
    elif collection == "saved":
        stmt = stmt.join(ResourceBookmark).where(ResourceBookmark.user_id == user_id)
    elif collection == "recent":
        stmt = stmt.join(ResourceView).where(ResourceView.user_id == user_id).order_by(desc(ResourceView.viewed_at))
    else:
        stmt = stmt.order_by(desc(AcademicResource.created_at))
    result = await db.execute(stmt.limit(300))
    items = []
    for resource in result.scalars().unique().all():
        uploader_name = resource.uploader.profile.full_name if resource.uploader and resource.uploader.profile else (resource.uploader.username if resource.uploader else "Anonymous")
        items.append({
            "id": resource.id, "title": resource.title, "subject_code": resource.subject_code or resource.subject or "",
            "publisher_name": resource.publisher_name or uploader_name, "original_filename": resource.file.filename if resource.file else "resource.pdf",
            "mime_type": resource.file.mime_type if resource.file else "application/pdf", "size_bytes": resource.size_bytes or (resource.file.size_bytes if resource.file else 0),
            "pages": resource.pages or 1, "download_count": resource.download_count, "uploader_id": resource.uploader_id,
            "uploader_name": uploader_name, "created_at": resource.created_at.isoformat(),
            "is_saved": any(bookmark.user_id == user_id for bookmark in resource.bookmarks),
            "download_url": f"/api/v1/academics/resources/{resource.id}/download",
        })
    return items


@router.get("/resources/mine")
async def my_resources(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await academic_resources_for_user(db, current_user.id, "mine")


@router.get("/resources/saved")
async def saved_resources(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await academic_resources_for_user(db, current_user.id, "saved")


@router.get("/resources/recent")
async def recent_resources(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await academic_resources_for_user(db, current_user.id, "recent")


@router.put("/resources/{resource_id}/saved")
async def save_resource(resource_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    resource = await db.get(AcademicResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    existing = (await db.execute(select(ResourceBookmark).where(ResourceBookmark.resource_id == resource_id, ResourceBookmark.user_id == current_user.id))).scalar_one_or_none()
    if not existing:
        db.add(ResourceBookmark(resource_id=resource_id, user_id=current_user.id))
        await db.commit()
    return {"saved": True}


@router.delete("/resources/{resource_id}/saved", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_resource(resource_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ResourceBookmark).where(ResourceBookmark.resource_id == resource_id, ResourceBookmark.user_id == current_user.id))
    await db.commit()


@router.delete("/resources/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_resource_history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ResourceView).where(ResourceView.user_id == current_user.id))
    await db.commit()


@router.get("/resources/{resource_id}/download")
async def download_academic_resource(resource_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    resource = await db.get(AcademicResource, resource_id)
    if not resource or not resource.file:
        raise HTTPException(status_code=404, detail="Resource not found")
    await db.execute(update(AcademicResource).where(AcademicResource.id == resource_id).values(download_count=AcademicResource.download_count + 1))
    view = await db.get(ResourceView, (resource_id, current_user.id))
    if view:
        view.viewed_at = datetime.now(timezone.utc)
    else:
        db.add(ResourceView(resource_id=resource_id, user_id=current_user.id))
    await db.commit()
    if storage_service.is_cloudinary_path(resource.file.file_path):
        return RedirectResponse(storage_service.get_download_url(resource.file.file_path), status_code=307)
    path = storage_service.get_absolute_path(resource.file.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resource file is unavailable")
    return FileResponse(path=str(path), media_type="application/pdf", filename=resource.file.filename)

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
