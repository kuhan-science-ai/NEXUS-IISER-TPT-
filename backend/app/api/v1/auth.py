import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.db.session import get_db
from backend.app.models.user import User, UserProfile, UserSettings, UserRole
from backend.app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserSummary,
    PasswordResetRequest,
    PasswordResetConfirm,
    DemoAccountInfo,
)
from backend.app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    login_rate_limiter,
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    # 1. Check existing username or email
    stmt = select(User).where((User.username == req.username.lower()) | (User.email == req.email.lower()))
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        if existing_user.username.lower() == req.username.lower():
            raise HTTPException(status_code=400, detail="Username is already taken")
        raise HTTPException(status_code=400, detail="Email is already registered")

    # 2. Create User
    new_user = User(
        username=req.username.lower(),
        email=req.email.lower(),
        hashed_password=get_password_hash(req.password),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,  # Dev default
    )
    db.add(new_user)
    await db.flush()

    # 3. Create default Profile and Settings
    new_profile = UserProfile(
        user_id=new_user.id,
        full_name=req.full_name,
        display_name=req.full_name,
        program=req.program or "BS-MS",
        academic_year=req.academic_year or "1st Year",
        department=req.department or "General Sciences",
    )
    new_settings = UserSettings(user_id=new_user.id)
    db.add(new_profile)
    db.add(new_settings)
    await db.commit()

    access_token = create_access_token({"sub": new_user.id, "role": new_user.role.value})
    refresh_token = create_refresh_token({"sub": new_user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=new_user.id,
        username=new_user.username,
        role=new_user.role,
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}_{req.username_or_email.lower()}"

    if login_rate_limiter.is_rate_limited(rate_limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again."
        )

    stmt = select(User).where(
        (User.username == req.username_or_email.lower()) | (User.email == req.username_or_email.lower())
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        login_rate_limiter.record_attempt(rate_limit_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Reset rate limit on success
    login_rate_limiter.reset(rate_limit_key)

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token({"sub": user.id, "role": user.role.value})
    refresh_token = create_refresh_token({"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        username=user.username,
        role=user.role,
    )

@router.get("/me", response_model=UserSummary)
async def get_me(current_user: User = Depends(get_current_user)):
    profile = current_user.profile
    return UserSummary(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        full_name=profile.full_name if profile else "",
        display_name=profile.display_name if profile else None,
        bio=profile.bio if profile else "",
        program=profile.program if profile else None,
        academic_year=profile.academic_year if profile else None,
        department=profile.department if profile else None,
        status_text=profile.status_text if profile else None,
        avatar_file_id=profile.avatar_file_id if profile else None,
        banner_file_id=profile.banner_file_id if profile else None,
        accent_color=profile.accent_color if profile else None,
    )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out"}

@router.post("/request-password-reset")
async def request_password_reset(req: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == req.email.lower())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user:
        reset_token = secrets.token_urlsafe(32)
        user.reset_password_token = reset_token
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        # In development mode, return token for straightforward verification
        return {"message": "Password reset token generated", "dev_reset_token": reset_token}
    return {"message": "If this email is registered, reset instructions have been issued"}

@router.post("/reset-password")
async def reset_password(req: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.reset_password_token == req.token)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not user or not user.reset_token_expires_at or user.reset_token_expires_at < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = get_password_hash(req.new_password)
    user.reset_password_token = None
    user.reset_token_expires_at = None
    await db.commit()
    return {"message": "Password successfully reset. You can now log in."}

@router.get("/demo-accounts", response_model=list[DemoAccountInfo])
async def get_demo_accounts():
    return [
        DemoAccountInfo(role="student", username="student1", email="student1@iisertirupati.ac.in", password="NexusPass123!"),
        DemoAccountInfo(role="moderator", username="moderator1", email="moderator1@iisertirupati.ac.in", password="NexusPass123!"),
        DemoAccountInfo(role="administrator", username="admin", email="admin@iisertirupati.ac.in", password="NexusAdmin123!"),
    ]
