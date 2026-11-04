from typing import Optional, List
from pydantic import BaseModel, Field

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=120)
    display_name: Optional[str] = Field(None, max_length=120)
    bio: Optional[str] = Field(None, max_length=1000)
    program: Optional[str] = Field(None, max_length=100)
    academic_year: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    status_text: Optional[str] = Field(None, max_length=200)
    accent_color: Optional[str] = Field(None, max_length=20)
    is_private: Optional[bool] = None

class UserSettingsUpdateRequest(BaseModel):
    email_notifications: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    last_seen_privacy: Optional[str] = None
    theme_preference: Optional[str] = None

class UserPublicProfile(BaseModel):
    id: str
    username: str
    full_name: str
    display_name: Optional[str] = None
    bio: Optional[str] = ""
    program: Optional[str] = None
    academic_year: Optional[str] = None
    department: Optional[str] = None
    status_text: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    accent_color: Optional[str] = None
    is_friend: bool = False
    is_blocked: bool = False
    mutual_friends_count: int = 0

class FriendRequestResponse(BaseModel):
    id: str
    sender_id: str
    sender_username: str
    sender_name: str
    receiver_id: str
    receiver_username: str
    status: str
    created_at: str

class FriendItem(BaseModel):
    id: str
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    department: Optional[str] = None
    status_text: Optional[str] = None
