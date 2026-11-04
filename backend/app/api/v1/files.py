from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.db.session import get_db
from backend.app.models.file import FileMetadata
from backend.app.models.user import User
from backend.app.services.storage import storage_service
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/files", tags=["File Storage"])

@router.post("/daily-question-attachment")
async def upload_daily_question_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(".pdf") or file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please choose a PDF file")
    header = await file.read(5)
    await file.seek(0)
    if header != b"%PDF-":
        raise HTTPException(status_code=400, detail="This file does not contain a valid PDF header")
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file, category="daily-question-answers", allowed_mimes={"application/pdf"},
        max_size=10 * 1024 * 1024,
    )
    meta = FileMetadata(
        filename=(file.filename or "answer.pdf")[:255], stored_filename=stored_name,
        file_path=rel_path, mime_type=mime, size_bytes=size_bytes,
        uploader_id=current_user.id, is_public=False, file_category="daily-question-answers",
    )
    db.add(meta)
    await db.commit()
    await db.refresh(meta)
    return {"file_id": meta.id, "filename": meta.filename, "size_bytes": meta.size_bytes}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("general"),
    is_public: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file,
        category=category,
    )

    meta = FileMetadata(
        filename=file.filename or "unknown",
        stored_filename=stored_name,
        file_path=rel_path,
        mime_type=mime,
        size_bytes=size_bytes,
        uploader_id=current_user.id,
        is_public=is_public,
        file_category=category,
    )
    db.add(meta)
    await db.commit()
    await db.refresh(meta)

    return {
        "file_id": meta.id,
        "filename": meta.filename,
        "mime_type": meta.mime_type,
        "size_bytes": meta.size_bytes,
        "category": meta.file_category,
        "download_url": f"/api/v1/files/{meta.id}/download",
    }

@router.get("/{file_id}/download")
async def download_file(file_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(FileMetadata).where(FileMetadata.id == file_id)
    result = await db.execute(stmt)
    meta = result.scalar_one_or_none()

    if not meta:
        raise HTTPException(status_code=404, detail="File not found")
    if meta.file_category == "daily-question-answers":
        raise HTTPException(status_code=404, detail="File not found")

    abs_path = storage_service.get_absolute_path(meta.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File data missing on disk")

    return FileResponse(
        path=str(abs_path),
        media_type=meta.mime_type,
        filename=meta.filename,
    )

@router.get("/{file_id}/info")
async def get_file_info(file_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(FileMetadata).where(FileMetadata.id == file_id)
    result = await db.execute(stmt)
    meta = result.scalar_one_or_none()

    if not meta:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "id": meta.id,
        "filename": meta.filename,
        "mime_type": meta.mime_type,
        "size_bytes": meta.size_bytes,
        "uploader_id": meta.uploader_id,
        "category": meta.file_category,
        "created_at": meta.created_at,
    }
