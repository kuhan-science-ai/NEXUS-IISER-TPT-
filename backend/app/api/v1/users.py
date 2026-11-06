from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_

from backend.app.db.session import get_db
from backend.app.models.user import User, UserProfile, UserSettings
from backend.app.models.file import FileMetadata
from backend.app.models.social import Friendship, BlockedUser
from backend.app.schemas.user import ProfileUpdateRequest, UserSettingsUpdateRequest, UserPublicProfile
from backend.app.services.storage import storage_service, ALLOWED_PROFILE_MEDIA_MIMES
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users & Profiles"])

@router.get("/check-username")
async def check_username(username: str = Query(..., min_length=3, max_length=30), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == username.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    return {"username": username, "available": user is None}

@router.get("/profile/{username}", response_model=UserPublicProfile)
async def get_profile(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).options(selectinload(User.profile)).where(User.username == username.lower())
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = target_user.profile
    if not profile:
        profile = UserProfile(user_id=target_user.id, full_name=target_user.username)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    # Check friendship
    f_stmt = select(Friendship).where(
        or_(
            and_(Friendship.user_id_1 == current_user.id, Friendship.user_id_2 == target_user.id),
            and_(Friendship.user_id_1 == target_user.id, Friendship.user_id_2 == current_user.id),
        )
    )
    f_res = await db.execute(f_stmt)
    is_friend = f_res.scalar_one_or_none() is not None

    # Check blocked
    b_stmt = select(BlockedUser).where(
        or_(
            and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == target_user.id),
            and_(BlockedUser.blocker_id == target_user.id, BlockedUser.blocked_id == current_user.id),
        )
    )
    b_res = await db.execute(b_stmt)
    is_blocked = b_res.scalar_one_or_none() is not None

    avatar_file = await db.get(FileMetadata, profile.avatar_file_id) if profile.avatar_file_id else None
    banner_file = await db.get(FileMetadata, profile.banner_file_id) if profile.banner_file_id else None
    avatar_url = f"/api/v1/files/{profile.avatar_file_id}/download" if profile.avatar_file_id else None
    banner_url = f"/api/v1/files/{profile.banner_file_id}/download" if profile.banner_file_id else None

    return UserPublicProfile(
        id=target_user.id,
        username=target_user.username,
        full_name=profile.full_name,
        display_name=profile.display_name,
        bio=profile.bio or "",
        program=profile.program,
        academic_year=profile.academic_year,
        department=profile.department,
        status_text=profile.status_text,
        avatar_url=avatar_url,
        banner_url=banner_url,
        avatar_mime_type=avatar_file.mime_type if avatar_file else None,
        banner_mime_type=banner_file.mime_type if banner_file else None,
        accent_color=profile.accent_color,
        is_friend=is_friend,
        is_blocked=is_blocked,
        mutual_friends_count=0,
    )

@router.put("/profile")
async def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    update_dict = req.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(profile, field, val)

    await db.commit()
    await db.refresh(profile)
    return {"message": "Profile updated successfully"}

@router.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file,
        category="avatars",
        allowed_mimes=ALLOWED_PROFILE_MEDIA_MIMES,
        max_size=8 * 1024 * 1024,
        delivery_type="upload",
    )

    meta = FileMetadata(
        filename=file.filename or "avatar.png",
        stored_filename=stored_name,
        file_path=rel_path,
        mime_type=mime,
        size_bytes=size_bytes,
        uploader_id=current_user.id,
        is_public=True,
        file_category="avatar",
    )
    db.add(meta)
    await db.flush()

    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile:
        profile.avatar_file_id = meta.id

    await db.commit()
    return {"message": "Avatar uploaded successfully", "avatar_file_id": meta.id, "avatar_url": f"/api/v1/files/{meta.id}/download"}

@router.delete("/profile/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile:
        profile.avatar_file_id = None
        await db.commit()
    return {"message": "Avatar removed"}

@router.post("/profile/banner")
async def upload_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stored_name, rel_path, size_bytes, mime = await storage_service.save_file(
        file=file,
        category="banners",
        allowed_mimes=ALLOWED_PROFILE_MEDIA_MIMES,
        max_size=10 * 1024 * 1024,
        delivery_type="upload",
    )

    meta = FileMetadata(
        filename=file.filename or "banner.png",
        stored_filename=stored_name,
        file_path=rel_path,
        mime_type=mime,
        size_bytes=size_bytes,
        uploader_id=current_user.id,
        is_public=True,
        file_category="banner",
    )
    db.add(meta)
    await db.flush()

    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile:
        profile.banner_file_id = meta.id

    await db.commit()
    return {"message": "Banner uploaded successfully", "banner_file_id": meta.id, "banner_url": f"/api/v1/files/{meta.id}/download"}

@router.delete("/profile/banner")
async def delete_banner(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if profile:
        profile.banner_file_id = None
        await db.commit()
    return {"message": "Banner removed"}

@router.put("/settings")
async def update_settings(
    req: UserSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSettings).where(UserSettings.user_id == current_user.id)
    result = await db.execute(stmt)
    user_settings = result.scalar_one_or_none()

    if not user_settings:
        user_settings = UserSettings(user_id=current_user.id)
        db.add(user_settings)

    update_dict = req.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(user_settings, k, v)

    await db.commit()
    return {"message": "Settings updated"}

@router.get("/settings")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSettings).where(UserSettings.user_id == current_user.id)
    result = await db.execute(stmt)
    user_settings = result.scalar_one_or_none()
    return user_settings
