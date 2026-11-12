from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from backend.app.models.message import ConversationType, MessageType, MemberRole

class ConversationCreateRequest(BaseModel):
    type: ConversationType = ConversationType.DIRECT
    title: Optional[str] = None
    description: Optional[str] = None
    participant_user_ids: List[str]

class MessageSendRequest(BaseModel):
    content: str = Field(..., max_length=10000)
    message_type: MessageType = MessageType.TEXT
    reply_to_id: Optional[str] = None
    attachment_file_ids: Optional[List[str]] = None

class MessageUpdateRequest(BaseModel):
    content: str = Field(..., max_length=10000)

class MessageReactionRequest(BaseModel):
    emoji: str = Field(..., max_length=32)

class AttachmentResponse(BaseModel):
    id: str
    file_id: str
    filename: str
    mime_type: str
    size_bytes: int
    download_url: str

class ReactionResponse(BaseModel):
    emoji: str
    count: int
    user_ids: List[str]

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: Optional[str]
    sender_username: Optional[str]
    sender_name: Optional[str]
    avatar_url: Optional[str] = None
    avatar_mime_type: Optional[str] = None
    content: str
    message_type: MessageType
    reply_to_id: Optional[str]
    reply_preview: Optional[str] = None
    is_pinned: bool
    is_edited: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentResponse] = []
    reactions: List[ReactionResponse] = []

class ConversationMemberSummary(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: MemberRole
    avatar_url: Optional[str] = None
    avatar_mime_type: Optional[str] = None

class ConversationSummary(BaseModel):
    id: str
    type: ConversationType
    title: Optional[str]
    description: Optional[str]
    creator_id: Optional[str]
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    members: List[ConversationMemberSummary] = []
    created_at: datetime
