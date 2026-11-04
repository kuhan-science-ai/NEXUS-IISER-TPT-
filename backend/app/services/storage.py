import os
import uuid
import aiofiles
from pathlib import Path
from typing import Tuple, Set
from fastapi import UploadFile, HTTPException
from backend.app.core.config import settings

ALLOWED_IMAGE_MIMES: Set[str] = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_PROFILE_MEDIA_MIMES: Set[str] = ALLOWED_IMAGE_MIMES | {"video/mp4", "video/webm"}
ALLOWED_DOCUMENT_MIMES: Set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "application/zip",
    "text/plain",
}
ALLOWED_AUDIO_MIMES: Set[str] = {"audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"}

class StorageService:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        # Category subdirectories
        (self.base_dir / "avatars").mkdir(exist_ok=True)
        (self.base_dir / "banners").mkdir(exist_ok=True)
        (self.base_dir / "attachments").mkdir(exist_ok=True)
        (self.base_dir / "academics").mkdir(exist_ok=True)
        (self.base_dir / "general").mkdir(exist_ok=True)

    async def save_file(
        self,
        file: UploadFile,
        category: str = "general",
        allowed_mimes: Set[str] = None,
        max_size: int = settings.MAX_UPLOAD_SIZE_BYTES
    ) -> Tuple[str, str, int, str]:
        """
        Saves file safely to disk and returns (stored_filename, relative_path, size_bytes, mime_type).
        """
        content_type = file.content_type or "application/octet-stream"
        if allowed_mimes and content_type not in allowed_mimes:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Allowed: {sorted(list(allowed_mimes))}"
            )

        # Sanitize extension
        original_ext = Path(file.filename or "file").suffix.lower()
        if not original_ext:
            original_ext = ".bin"

        stored_filename = f"{uuid.uuid4().hex}{original_ext}"
        cat_dir = self.base_dir / category
        cat_dir.mkdir(parents=True, exist_ok=True)
        dest_path = cat_dir / stored_filename

        bytes_written = 0
        chunk_size = 1024 * 64  # 64 KB chunks

        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(chunk_size):
                bytes_written += len(chunk)
                if bytes_written > max_size:
                    buffer.close()
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {max_size / (1024 * 1024):.1f} MB"
                    )
                buffer.write(chunk)

        relative_path = f"{category}/{stored_filename}"
        return stored_filename, relative_path, bytes_written, content_type

    def get_absolute_path(self, relative_path: str) -> Path:
        resolved = (self.base_dir / relative_path).resolve()
        # Security: ensure path traversal is prevented
        if not str(resolved).startswith(str(self.base_dir.resolve())):
            raise HTTPException(status_code=400, detail="Invalid path traversal detected")
        return resolved

    def delete_file(self, relative_path: str) -> bool:
        try:
            target = self.get_absolute_path(relative_path)
            if target.exists() and target.is_file():
                target.unlink()
                return True
        except Exception:
            pass
        return False

storage_service = StorageService()
