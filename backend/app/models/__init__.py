from backend.app.db.base import Base
from backend.app.models.user import User, UserProfile, UserSettings, UserRole
from backend.app.models.file import FileMetadata
from backend.app.models.social import Friendship, FriendRequest, FriendRequestStatus, BlockedUser
from backend.app.models.message import (
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    MessageReaction,
    MessageReadReceipt,
    ConversationType,
    MemberRole,
    MessageType,
)
from backend.app.models.academic import (
    Course,
    CourseEnrollment,
    AcademicResource,
    ResourceBookmark,
    ResourceRating,
)
from backend.app.models.forum import ForumPost, ForumComment, ForumVote, StudyGroup, VoteType
from backend.app.models.calendar import CalendarEvent, Task, Note, EventType
from backend.app.models.notification import Notification, NotificationType
from backend.app.models.campus import (
    Event,
    EventRegistration,
    CampusPulseItem,
    LostFoundItem,
    Opportunity,
    DailyQuestion,
    DailyQuestionAnswer,
    DailyQuestionAnswerComment,
    DailyQuestionProposal,
)
from backend.app.models.ai import (
    AIConversation,
    AIMessage,
    AIToolExecution,
    AIMessageRole,
    ToolExecutionStatus,
)
from backend.app.models.audit import AuditLog

__all__ = [
    "Base",
    "User",
    "UserProfile",
    "UserSettings",
    "UserRole",
    "FileMetadata",
    "Friendship",
    "FriendRequest",
    "FriendRequestStatus",
    "BlockedUser",
    "Conversation",
    "ConversationMember",
    "Message",
    "MessageAttachment",
    "MessageReaction",
    "MessageReadReceipt",
    "ConversationType",
    "MemberRole",
    "MessageType",
    "Course",
    "CourseEnrollment",
    "AcademicResource",
    "ResourceBookmark",
    "ResourceRating",
    "ForumPost",
    "ForumComment",
    "ForumVote",
    "StudyGroup",
    "VoteType",
    "CalendarEvent",
    "Task",
    "Note",
    "EventType",
    "Notification",
    "NotificationType",
    "Event",
    "EventRegistration",
    "CampusPulseItem",
    "LostFoundItem",
    "Opportunity",
    "DailyQuestion",
    "DailyQuestionAnswer",
    "DailyQuestionAnswerComment",
    "DailyQuestionProposal",
    "AIConversation",
    "AIMessage",
    "AIToolExecution",
    "AIMessageRole",
    "ToolExecutionStatus",
    "AuditLog",
]
