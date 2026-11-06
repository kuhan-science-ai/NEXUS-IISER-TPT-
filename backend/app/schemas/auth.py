from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from backend.app.models.user import UserRole

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=120)
    program: Optional[str] = "BS-MS"
    academic_year: Optional[str] = "1st Year"
    department: Optional[str] = "General Sciences"

class UserLoginRequest(BaseModel):
    username_or_email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    role: UserRole

class UserSummary(BaseModel):
    id: str
    username: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    full_name: Optional[str] = ""
    display_name: Optional[str] = None
    bio: Optional[str] = ""
    program: Optional[str] = None
    academic_year: Optional[str] = None
    department: Optional[str] = None
    status_text: Optional[str] = None
    avatar_file_id: Optional[str] = None
    banner_file_id: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    avatar_mime_type: Optional[str] = None
    banner_mime_type: Optional[str] = None
    accent_color: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class DemoAccountInfo(BaseModel):
    role: str
    username: str
    email: str
