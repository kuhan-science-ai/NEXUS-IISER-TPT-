import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Optional, Set, Tuple

import aiofiles
from fastapi import HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from backend.app.core.config import settings

ALLOWED_IMAGE_MIMES: Set[str] = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_PROFILE_MEDIA_MIMES: Set[str] = ALLOWED_IMAGE_MIMES | {"video/mp4", "video/webm"}
ALLOWED_DOCUMENT_MIMES: Set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
}
ALLOWED_AUDIO_MIMES: Set[str] = {"audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"}


class StorageService:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        for category in ("avatars", "banners", "attachments", "academics", "general"):
            (self.base_dir / category).mkdir(exist_ok=True)

        credentials = (
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        )
        self.cloudinary_enabled = any(credentials)
        self.cloudinary = None
        if self.cloudinary_enabled:
            if not all(credentials):
                raise RuntimeError(
                    "Cloudinary configuration is incomplete. Set CLOUDINARY_CLOUD_NAME, "
                    "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or leave all three blank."
                )
            try:
                import cloudinary
                import cloudinary.uploader
                import cloudinary.utils

                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True,
                )
                self.cloudinary = cloudinary
            except ImportError as exc:
                raise RuntimeError(
                    "Cloudinary is configured, but its SDK is missing. Install backend requirements."
                ) from exc

    @staticmethod
    def _cloudinary_metadata(file_path: str) -> Optional[dict]:
        try:
            metadata = json.loads(file_path)
        except (TypeError, json.JSONDecodeError):
            return None
        return metadata if isinstance(metadata, dict) and metadata.get("provider") == "cloudinary" else None

    def is_cloudinary_path(self, file_path: str) -> bool:
        return self._cloudinary_metadata(file_path) is not None

    async def save_file(
        self,
        file: UploadFile,
        category: str = "general",
        allowed_mimes: Optional[Set[str]] = None,
        max_size: int = settings.MAX_UPLOAD_SIZE_BYTES,
        delivery_type: Optional[str] = None,
    ) -> Tuple[str, str, int, str]:
        """Store a file and return (stored filename, storage path, size, MIME type)."""
        content_type = file.content_type or "application/octet-stream"
        if allowed_mimes and content_type not in allowed_mimes:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,50}", category):
            raise HTTPException(status_code=400, detail="Invalid storage category")

        file.file.seek(0, os.SEEK_END)
        size_bytes = file.file.tell()
        file.file.seek(0)
        if size_bytes == 0:
            raise HTTPException(status_code=400, detail="Empty files cannot be uploaded")
        if size_bytes > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size of {max_size / (1024 * 1024):.1f} MB",
            )

        original_ext = Path(file.filename or "file").suffix.lower() or ".bin"
        stored_filename = f"{uuid.uuid4().hex}{original_ext}"

        if self.cloudinary_enabled:
            resource_type = (
                "image" if content_type.startswith("image/")
                else "video" if content_type.startswith(("video/", "audio/"))
                else "raw"
            )
            asset_delivery_type = delivery_type or "authenticated"
            if asset_delivery_type not in {"upload", "private", "authenticated"}:
                raise HTTPException(status_code=400, detail="Invalid storage delivery type")

            try:
                result = await run_in_threadpool(
                    self.cloudinary.uploader.upload,
                    file.file,
                    public_id=f"{category}/{uuid.uuid4().hex}",
                    resource_type=resource_type,
                    type=asset_delivery_type,
                    overwrite=False,
                    unique_filename=False,
                )
            except Exception as exc:
                raise HTTPException(status_code=502, detail="File upload failed. Please try again.") from exc

            metadata = {
                "provider": "cloudinary",
                "public_id": result["public_id"],
                "resource_type": result["resource_type"],
                "delivery_type": asset_delivery_type,
                "format": result.get("format", ""),
                "secure_url": result.get("secure_url", ""),
            }
            return stored_filename, json.dumps(metadata, separators=(",", ":")), size_bytes, content_type

        cat_dir = self.base_dir / category
        cat_dir.mkdir(parents=True, exist_ok=True)
        dest_path = cat_dir / stored_filename
        bytes_written = 0
        chunk_size = 1024 * 64
        try:
            async with aiofiles.open(dest_path, "wb") as buffer:
                while chunk := await file.read(chunk_size):
                    bytes_written += len(chunk)
                    if bytes_written > max_size:
                        raise HTTPException(
                            status_code=413,
                            detail=f"File exceeds maximum allowed size of {max_size / (1024 * 1024):.1f} MB",
                        )
                    await buffer.write(chunk)
        except Exception:
            dest_path.unlink(missing_ok=True)
            raise

        return stored_filename, f"{category}/{stored_filename}", bytes_written, content_type

    def get_download_url(self, file_path: str, expires_in: int = 300, attachment: bool = True) -> str:
        metadata = self._cloudinary_metadata(file_path)
        if not metadata or not self.cloudinary_enabled:
            raise HTTPException(status_code=404, detail="Cloud storage metadata is unavailable")
        if metadata["delivery_type"] == "upload":
            return metadata["secure_url"]

        try:
            return self.cloudinary.utils.private_download_url(
                metadata["public_id"],
                metadata.get("format") or None,
                resource_type=metadata["resource_type"],
                type=metadata["delivery_type"],
                expires_at=int(time.time()) + max(60, min(expires_in, 3600)),
                attachment=attachment,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Unable to generate file download URL") from exc

    def get_absolute_path(self, relative_path: str) -> Path:
        if self.is_cloudinary_path(relative_path):
            raise HTTPException(status_code=400, detail="File is stored remotely")
        resolved = (self.base_dir / relative_path).resolve()
        if not resolved.is_relative_to(self.base_dir):
            raise HTTPException(status_code=400, detail="Invalid path traversal detected")
        return resolved

    def delete_file(self, file_path: str) -> bool:
        metadata = self._cloudinary_metadata(file_path)
        if metadata and self.cloudinary_enabled:
            try:
                result = self.cloudinary.uploader.destroy(
                    metadata["public_id"],
                    resource_type=metadata["resource_type"],
                    type=metadata["delivery_type"],
                )
                return result.get("result") == "ok"
            except Exception:
                return False
        try:
            target = self.get_absolute_path(file_path)
            if target.exists() and target.is_file():
                target.unlink()
                return True
        except Exception:
            pass
        return False


storage_service = StorageService()
