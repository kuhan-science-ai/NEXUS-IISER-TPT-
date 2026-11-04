import enum
from datetime import datetime, date, time, timezone
from typing import Dict, Any, Callable, Optional, List
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from backend.app.models.academic import AcademicResource, Course
from backend.app.models.calendar import CalendarEvent, EventType, Task
from backend.app.models.campus import Event as CampusEvent, EventRegistration
from backend.app.models.file import FileMetadata
from backend.app.models.message import Conversation, ConversationMember, Message, MessageType
from backend.app.models.notification import Notification, NotificationType
from backend.app.models.user import UserProfile, UserSettings

class SafetyTier(str, enum.Enum):
    READ_ONLY = "read_only"
    REVERSIBLE = "reversible"
    DESTRUCTIVE = "destructive"
    EXTERNAL = "external"

class ToolParameter(BaseModel):
    name: str
    type: str
    description: str
    required: bool = True

class ToolDefinition(BaseModel):
    name: str
    description: str
    safety_tier: SafetyTier
    parameters: List[ToolParameter]
    requires_confirmation: bool = False

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._executors: Dict[str, Callable] = {}
        self._register_default_tools()

    def register(self, definition: ToolDefinition, executor: Callable) -> None:
        self._tools[definition.name] = definition
        self._executors[definition.name] = executor

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    async def execute_tool(self, name: str, args: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        executor = self._executors.get(name)
        if not executor:
            return {"error": f"Tool '{name}' not found in registry"}
        try:
            return await executor(args, context)
        except Exception as e:
            return {"error": f"Tool execution failed: {str(e)}"}

    def _register_default_tools(self):
        # 1. Search Academic Repository
        self.register(
            ToolDefinition(
                name="search_academic_repository",
                description="Search peer-uploaded lecture notes, exam papers, and laboratory guides across IISER courses.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[
                    ToolParameter(name="query", type="string", description="Search terms e.g. Quantum harmonic oscillator notes"),
                    ToolParameter(name="course_code", type="string", description="Optional course filter e.g. PHY201", required=False),
                ],
                requires_confirmation=False,
            ),
            self._mock_search_repository,
        )

        # 2. Search Courses
        self.register(
            ToolDefinition(
                name="search_courses",
                description="Look up IISER Tirupati course offerings, syllabi, and faculty information.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[
                    ToolParameter(name="department", type="string", description="Department name e.g. Physics, Chemistry, Biology"),
                ],
                requires_confirmation=False,
            ),
            self._mock_search_courses,
        )

        # 3. Search Uploaded Documents
        self.register(
            ToolDefinition(
                name="search_uploaded_documents",
                description="Index and search the user's personal uploaded PDFs and documents.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[
                    ToolParameter(name="query", type="string", description="Document search query"),
                ],
                requires_confirmation=False,
            ),
            self._mock_search_docs,
        )

        # 4. Search Conversations
        self.register(
            ToolDefinition(
                name="search_conversations",
                description="Search the user's message history across direct and group discussions.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[
                    ToolParameter(name="query", type="string", description="Keywords to find in messages"),
                ],
                requires_confirmation=False,
            ),
            self._mock_search_messages,
        )

        self.register(
            ToolDefinition(
                name="send_internal_message",
                description="Send a message only to a NEXUS conversation the signed-in user belongs to. Requires explicit approval before posting.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="conversation_id", type="string", description="Conversation ID from the user's messages"),
                    ToolParameter(name="content", type="string", description="Message to send"),
                ],
                requires_confirmation=True,
            ),
            self._send_internal_message,
        )

        # 5. Retrieve Calendar Events
        self.register(
            ToolDefinition(
                name="retrieve_calendar_events",
                description="Retrieve scheduled academic timetable, exams, and personal events.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[
                    ToolParameter(name="date", type="string", description="Target date (YYYY-MM-DD)", required=False),
                ],
                requires_confirmation=False,
            ),
            self._get_calendar,
        )

        # 6. Create Calendar Event
        self.register(
            ToolDefinition(
                name="create_calendar_event",
                description="Add an event or study session to the student's calendar.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="title", type="string", description="Event title"),
                    ToolParameter(name="start_time", type="string", description="ISO start time"),
                    ToolParameter(name="end_time", type="string", description="ISO end time"),
                    ToolParameter(name="location", type="string", description="Optional event location", required=False),
                    ToolParameter(name="description", type="string", description="Optional event details", required=False),
                ],
                requires_confirmation=True,
            ),
            self._create_calendar,
        )

        self.register(
            ToolDefinition(
                name="update_calendar_event",
                description="Change one of the signed-in student's existing personal calendar events. Ask for an event ID from retrieve_calendar_events if needed.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="event_id", type="string", description="ID of the user's calendar event"),
                    ToolParameter(name="title", type="string", description="Replacement title", required=False),
                    ToolParameter(name="start_time", type="string", description="Replacement ISO start time", required=False),
                    ToolParameter(name="end_time", type="string", description="Replacement ISO end time", required=False),
                    ToolParameter(name="location", type="string", description="Replacement location", required=False),
                    ToolParameter(name="description", type="string", description="Replacement description", required=False),
                ],
                requires_confirmation=True,
            ),
            self._update_calendar,
        )

        self.register(
            ToolDefinition(
                name="retrieve_campus_events",
                description="Find upcoming published campus events and their IDs. Use this before updating a campus event.",
                safety_tier=SafetyTier.READ_ONLY, parameters=[], requires_confirmation=False,
            ),
            self._get_campus_events,
        )

        self.register(
            ToolDefinition(
                name="update_campus_event",
                description="Edit a campus event only if the signed-in user organized it or is an administrator. Requires user confirmation.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="event_id", type="string", description="Campus event ID"),
                    ToolParameter(name="title", type="string", description="Replacement title", required=False),
                    ToolParameter(name="description", type="string", description="Replacement description", required=False),
                    ToolParameter(name="category", type="string", description="Replacement category", required=False),
                    ToolParameter(name="location", type="string", description="Replacement location", required=False),
                    ToolParameter(name="start_time", type="string", description="Replacement ISO start time", required=False),
                    ToolParameter(name="end_time", type="string", description="Replacement ISO end time", required=False),
                    ToolParameter(name="capacity", type="integer", description="Replacement capacity", required=False),
                ],
                requires_confirmation=True,
            ),
            self._update_campus_event,
        )

        self.register(
            ToolDefinition(
                name="rsvp_campus_event",
                description="Register or cancel the signed-in student's RSVP for a campus event. Requires explicit approval.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="event_id", type="string", description="Campus event ID from retrieve_campus_events"),
                    ToolParameter(name="register", type="boolean", description="True to RSVP, false to cancel"),
                ],
                requires_confirmation=True,
            ),
            self._rsvp_campus_event,
        )

        # 7. Retrieve Assignments
        self.register(
            ToolDefinition(
                name="retrieve_assignments",
                description="Fetch upcoming problem sets, lab reports, and assignment deadlines.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[],
                requires_confirmation=False,
            ),
            self._get_assignments,
        )

        self.register(
            ToolDefinition(
                name="create_task",
                description="Create a personal task or assignment reminder for the signed-in student.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="title", type="string", description="Task title"),
                    ToolParameter(name="description", type="string", description="Task details", required=False),
                    ToolParameter(name="due_date", type="string", description="Optional ISO due date/time", required=False),
                    ToolParameter(name="priority", type="string", description="low, medium, high, or urgent", required=False),
                    ToolParameter(name="category", type="string", description="Task category", required=False),
                ],
                requires_confirmation=True,
            ),
            self._create_task,
        )

        self.register(
            ToolDefinition(
                name="update_task",
                description="Edit a personal task owned by the signed-in student. Use retrieve_assignments to find its ID.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="task_id", type="string", description="Task ID"),
                    ToolParameter(name="title", type="string", description="New task title", required=False),
                    ToolParameter(name="description", type="string", description="New task details", required=False),
                    ToolParameter(name="due_date", type="string", description="New ISO due date/time", required=False),
                    ToolParameter(name="priority", type="string", description="low, medium, high, or urgent", required=False),
                    ToolParameter(name="category", type="string", description="New task category", required=False),
                    ToolParameter(name="is_completed", type="boolean", description="Whether the task is complete", required=False),
                ],
                requires_confirmation=True,
            ),
            self._update_task,
        )

        self.register(
            ToolDefinition(
                name="get_my_profile",
                description="Read the signed-in student's editable public profile fields.",
                safety_tier=SafetyTier.READ_ONLY, parameters=[], requires_confirmation=False,
            ),
            self._get_my_profile,
        )

        self.register(
            ToolDefinition(
                name="update_my_profile",
                description="Edit profile fields belonging to the signed-in student. When changing the profile name, set full_name and display_name to the requested name.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="full_name", type="string", description="Profile name", required=False),
                    ToolParameter(name="display_name", type="string", description="Displayed profile name", required=False),
                    ToolParameter(name="bio", type="string", description="Profile biography", required=False),
                    ToolParameter(name="status_text", type="string", description="Profile status", required=False),
                    ToolParameter(name="program", type="string", description="Academic program", required=False),
                    ToolParameter(name="academic_year", type="string", description="Academic year", required=False),
                    ToolParameter(name="department", type="string", description="Department", required=False),
                ],
                requires_confirmation=True,
            ),
            self._update_my_profile,
        )

        self.register(
            ToolDefinition(
                name="get_my_settings",
                description="Read the signed-in student's theme, notification, sound, and presence privacy settings.",
                safety_tier=SafetyTier.READ_ONLY, parameters=[], requires_confirmation=False,
            ),
            self._get_my_settings,
        )

        self.register(
            ToolDefinition(
                name="update_my_settings",
                description="Change settings of the signed-in student's own NEXUS account. Theme must be system, dark, or light; last_seen_privacy must be everyone, friends, or nobody.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="theme_preference", type="string", description="system, dark, or light", required=False),
                    ToolParameter(name="email_notifications", type="boolean", description="Enable email notifications", required=False),
                    ToolParameter(name="sound_enabled", type="boolean", description="Enable UI sounds", required=False),
                    ToolParameter(name="last_seen_privacy", type="string", description="everyone, friends, or nobody", required=False),
                ],
                requires_confirmation=True,
            ),
            self._update_my_settings,
        )

        # 8. Retrieve Announcements
        self.register(
            ToolDefinition(
                name="retrieve_announcements",
                description="Fetch official institute and course notices.",
                safety_tier=SafetyTier.READ_ONLY,
                parameters=[],
                requires_confirmation=False,
            ),
            self._mock_get_announcements,
        )

        # 9. Draft Email
        self.register(
            ToolDefinition(
                name="draft_email",
                description="Email drafting is unavailable because no email integration is connected. Report that clearly; do not claim a draft was saved.",
                safety_tier=SafetyTier.REVERSIBLE,
                parameters=[
                    ToolParameter(name="recipient_email", type="string", description="Target email address"),
                    ToolParameter(name="subject", type="string", description="Subject line"),
                    ToolParameter(name="body", type="string", description="Email body text"),
                ],
                requires_confirmation=False,
            ),
            self._mock_draft_email,
        )

        # 10. Send External Communication (Destructive / External - Requires Confirmation)
        self.register(
            ToolDefinition(
                name="send_external_communication",
                description="External email delivery is not configured. Report that clearly; this tool cannot send anything.",
                safety_tier=SafetyTier.EXTERNAL,
                parameters=[
                    ToolParameter(name="recipient", type="string", description="Recipient identifier"),
                    ToolParameter(name="content", type="string", description="Message content to transmit"),
                ],
                requires_confirmation=False,
            ),
            self._mock_send_communication,
        )

    # --- Tool Implementations ---
    async def _mock_search_repository(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Repository database is unavailable."}
        query = args.get("query", "")
        like = f"%{query.strip().lower()}%"
        stmt = select(AcademicResource, Course).outerjoin(Course, AcademicResource.course_id == Course.id)
        stmt = stmt.where(or_(
            func.lower(AcademicResource.title).like(like),
            func.lower(func.coalesce(AcademicResource.description, "")).like(like),
            func.lower(func.coalesce(AcademicResource.subject, "")).like(like),
            func.lower(func.coalesce(Course.code, "")).like(like),
            func.lower(func.coalesce(Course.name, "")).like(like),
        ))
        if args.get("course_code"):
            stmt = stmt.where(func.lower(Course.code) == args["course_code"].lower())
        rows = (await db.execute(stmt.order_by(AcademicResource.created_at.desc()).limit(20))).all()
        return {
            "status": "success",
            "matches": [{"id": resource.id, "title": resource.title, "course": f"{course.code} - {course.name}" if course else None,
                         "category": resource.category, "subject": resource.subject, "download_count": resource.download_count}
                        for resource, course in rows],
            "total": len(rows),
        }

    async def _mock_search_courses(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Course database is unavailable."}
        dept = args.get("department", "Physics")
        like = f"%{dept.strip().lower()}%"
        rows = (await db.execute(select(Course).where(
            Course.is_active.is_(True),
            or_(func.lower(Course.department).like(like), func.lower(Course.name).like(like), func.lower(Course.code).like(like)),
        ).order_by(Course.code).limit(30))).scalars().all()
        return {
            "status": "success",
            "courses": [{"id": course.id, "code": course.code, "name": course.name, "department": course.department,
                         "credits": course.credits, "faculty": course.faculty_name, "semester": course.semester}
                        for course in rows],
        }

    async def _mock_search_docs(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Uploaded-file database is unavailable."}
        query = f"%{args.get('query', '').strip().lower()}%"
        rows = (await db.execute(select(FileMetadata).where(
            FileMetadata.uploader_id == ctx["user_id"], func.lower(FileMetadata.filename).like(query)
        ).order_by(FileMetadata.created_at.desc()).limit(30))).scalars().all()
        return {"status": "success", "results": [{"id": file.id, "file": file.filename, "mime_type": file.mime_type,
                                                      "size_bytes": file.size_bytes, "file_category": file.file_category}
                                                     for file in rows]}

    async def _mock_search_messages(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Messaging database is unavailable."}
        query = f"%{args.get('query', '').strip().lower()}%"
        member_conversations = select(ConversationMember.conversation_id).where(ConversationMember.user_id == ctx["user_id"])
        rows = (await db.execute(select(Message).where(
            Message.conversation_id.in_(member_conversations), Message.is_deleted.is_(False), func.lower(Message.content).like(query)
        ).order_by(Message.created_at.desc()).limit(20))).scalars().all()
        return {"status": "success", "conversations_found": len({message.conversation_id for message in rows}),
                "snippets": [{"conversation_id": message.conversation_id, "sender_id": message.sender_id,
                              "content": message.content[:500], "created_at": message.created_at.isoformat()} for message in rows]}

    async def _send_internal_message(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        content = str(args.get("content", "")).strip()
        if db is None or not content:
            return {"status": "error", "message": "Messaging database or message text is missing."}
        member = (await db.execute(select(ConversationMember.id).where(
            ConversationMember.conversation_id == args["conversation_id"],
            ConversationMember.user_id == ctx["user_id"],
        ))).scalar_one_or_none()
        if not member:
            return {"status": "error", "message": "You are not a member of that conversation."}
        message = Message(conversation_id=args["conversation_id"], sender_id=ctx["user_id"], content=content, message_type=MessageType.TEXT)
        db.add(message)
        conversation = (await db.execute(select(Conversation).where(Conversation.id == args["conversation_id"]))).scalar_one_or_none()
        if conversation:
            conversation.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(message)
        return {"status": "success", "action": "sent", "message_id": message.id, "conversation_id": message.conversation_id, "content": message.content}

    async def _mock_get_calendar(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "success",
            "events": [
                {"title": "PHY201 Lecture", "time": "10:00 - 11:30 AM", "location": "Lecture Hall 2"},
                {"title": "Organic Chemistry Lab", "time": "02:00 - 05:00 PM", "location": "Lab 103"}
            ]
        }

    async def _mock_create_calendar(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "success", "action": "created", "event_title": args.get("title")}

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    async def _get_calendar(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Calendar database is unavailable."}
        query = select(CalendarEvent).where(CalendarEvent.user_id == ctx["user_id"])
        if args.get("date"):
            day = date.fromisoformat(args["date"])
            start = datetime.combine(day, time.min, tzinfo=timezone.utc)
            end = datetime.combine(day, time.max, tzinfo=timezone.utc)
            query = query.where(CalendarEvent.start_time >= start, CalendarEvent.start_time <= end)
        rows = (await db.execute(query.order_by(CalendarEvent.start_time).limit(50))).scalars().all()
        return {"status": "success", "events": [{
            "id": e.id, "title": e.title, "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat(), "location": e.location, "description": e.description,
        } for e in rows]}

    async def _get_campus_events(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Campus events database is unavailable."}
        rows = (await db.execute(select(CampusEvent).order_by(CampusEvent.start_time).limit(50))).scalars().all()
        return {"status": "success", "events": [{
            "id": event.id, "title": event.title, "category": event.category, "location": event.location,
            "start_time": event.start_time.isoformat(), "end_time": event.end_time.isoformat(),
            "organizer_id": event.organizer_id,
        } for event in rows]}

    async def _update_campus_event(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Campus events database is unavailable."}
        event = (await db.execute(select(CampusEvent).where(CampusEvent.id == args["event_id"]))).scalar_one_or_none()
        if not event:
            return {"status": "error", "message": "Campus event not found."}
        if event.organizer_id != ctx.get("user_id") and ctx.get("role") != "administrator":
            return {"status": "error", "message": "Only the event organizer or an administrator can change this campus event."}
        for field in ("title", "description", "category", "location", "capacity"):
            if field in args and args[field] is not None:
                setattr(event, field, args[field])
        for field in ("start_time", "end_time"):
            if args.get(field):
                setattr(event, field, self._parse_datetime(args[field]))
        if event.end_time <= event.start_time:
            return {"status": "error", "message": "End time must be later than start time."}
        await db.commit()
        return {"status": "success", "action": "updated", "id": event.id, "title": event.title}

    async def _rsvp_campus_event(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Campus events database is unavailable."}
        event = (await db.execute(select(CampusEvent).where(CampusEvent.id == args["event_id"]))).scalar_one_or_none()
        if not event:
            return {"status": "error", "message": "Campus event not found."}
        registration = (await db.execute(select(EventRegistration).where(
            EventRegistration.event_id == event.id, EventRegistration.user_id == ctx["user_id"]
        ))).scalar_one_or_none()
        if args.get("register", True):
            if registration:
                return {"status": "success", "action": "already_registered", "event": event.title}
            if event.capacity:
                count = (await db.execute(select(func.count(EventRegistration.id)).where(
                    EventRegistration.event_id == event.id, EventRegistration.status == "registered"
                ))).scalar_one()
                if count >= event.capacity:
                    return {"status": "error", "message": "This event has reached capacity."}
            db.add(EventRegistration(event_id=event.id, user_id=ctx["user_id"], status="registered"))
            action = "registered"
        else:
            if not registration:
                return {"status": "success", "action": "not_registered", "event": event.title}
            await db.delete(registration)
            action = "cancelled"
        await db.commit()
        return {"status": "success", "action": action, "event": event.title, "event_id": event.id}

    async def _get_assignments(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Task database is unavailable."}
        rows = (await db.execute(select(Task).where(Task.user_id == ctx["user_id"]).order_by(Task.is_completed, Task.due_date).limit(50))).scalars().all()
        return {"status": "success", "assignments": [{
            "id": t.id, "title": t.title, "description": t.description, "due_date": t.due_date.isoformat() if t.due_date else None,
            "is_completed": t.is_completed, "priority": t.priority, "category": t.category,
        } for t in rows]}

    async def _create_task(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Task database is unavailable."}
        priority = args.get("priority", "medium")
        if priority not in {"low", "medium", "high", "urgent"}:
            return {"status": "error", "message": "Priority must be low, medium, high, or urgent."}
        task = Task(
            user_id=ctx["user_id"], title=str(args.get("title", "")).strip(), description=args.get("description"),
            due_date=self._parse_datetime(args["due_date"]) if args.get("due_date") else None,
            priority=priority, category=args.get("category", "study"),
        )
        if not task.title:
            return {"status": "error", "message": "Task title is required."}
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return {"status": "success", "action": "created", "id": task.id, "title": task.title, "due_date": task.due_date.isoformat() if task.due_date else None}

    async def _update_task(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Task database is unavailable."}
        task = (await db.execute(select(Task).where(Task.id == args["task_id"], Task.user_id == ctx["user_id"]))).scalar_one_or_none()
        if not task:
            return {"status": "error", "message": "Task not found in your account."}
        if args.get("priority") and args["priority"] not in {"low", "medium", "high", "urgent"}:
            return {"status": "error", "message": "Priority must be low, medium, high, or urgent."}
        for field in ("title", "description", "priority", "category", "is_completed"):
            if field in args and args[field] is not None:
                setattr(task, field, args[field])
        if "due_date" in args:
            task.due_date = self._parse_datetime(args["due_date"]) if args["due_date"] else None
        await db.commit()
        return {"status": "success", "action": "updated", "id": task.id, "title": task.title, "is_completed": task.is_completed}

    async def _get_my_profile(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Profile database is unavailable."}
        profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == ctx["user_id"]))).scalar_one_or_none()
        if not profile:
            return {"status": "success", "profile": {}}
        return {"status": "success", "profile": {field: getattr(profile, field) for field in (
            "full_name", "display_name", "bio", "status_text", "program", "academic_year", "department"
        )}}

    async def _update_my_profile(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        allowed = {"full_name", "display_name", "bio", "status_text", "program", "academic_year", "department"}
        updates = {key: value for key, value in args.items() if key in allowed and value is not None}
        if not updates:
            return {"status": "error", "message": "No profile changes were provided."}
        if "full_name" in updates and "display_name" not in updates:
            updates["display_name"] = updates["full_name"]
        profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == ctx["user_id"]))).scalar_one_or_none()
        if not profile:
            profile = UserProfile(user_id=ctx["user_id"])
            db.add(profile)
        for field, value in updates.items():
            setattr(profile, field, value)
        await db.commit()
        return {"status": "success", "action": "updated", "profile": updates}

    async def _get_my_settings(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Settings database is unavailable."}
        settings = (await db.execute(select(UserSettings).where(UserSettings.user_id == ctx["user_id"]))).scalar_one_or_none()
        if not settings:
            return {"status": "success", "settings": {}}
        return {"status": "success", "settings": {field: getattr(settings, field) for field in (
            "theme_preference", "email_notifications", "sound_enabled", "last_seen_privacy"
        )}}

    async def _update_my_settings(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        allowed = {"theme_preference", "email_notifications", "sound_enabled", "last_seen_privacy"}
        updates = {key: value for key, value in args.items() if key in allowed and value is not None}
        if not updates:
            return {"status": "error", "message": "No settings changes were provided."}
        if updates.get("theme_preference") not in (None, "system", "dark", "light"):
            return {"status": "error", "message": "Theme must be system, dark, or light."}
        if updates.get("last_seen_privacy") not in (None, "everyone", "friends", "nobody"):
            return {"status": "error", "message": "Presence privacy must be everyone, friends, or nobody."}
        settings = (await db.execute(select(UserSettings).where(UserSettings.user_id == ctx["user_id"]))).scalar_one_or_none()
        if not settings:
            settings = UserSettings(user_id=ctx["user_id"])
            db.add(settings)
        for field, value in updates.items():
            setattr(settings, field, value)
        await db.commit()
        return {"status": "success", "action": "updated", "settings": updates}

    async def _create_calendar(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Calendar database is unavailable; no event was created."}
        title = str(args.get("title", "")).strip()
        start, end = self._parse_datetime(args["start_time"]), self._parse_datetime(args["end_time"])
        if not title or end <= start:
            return {"status": "error", "message": "A title and end time later than start time are required."}
        event = CalendarEvent(
            user_id=ctx["user_id"], title=title, start_time=start, end_time=end,
            location=args.get("location"), description=args.get("description"), event_type=EventType.PERSONAL,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return {"status": "success", "action": "created", "id": event.id, "title": event.title, "start_time": event.start_time.isoformat()}

    async def _update_calendar(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "error", "message": "Calendar database is unavailable."}
        event = (await db.execute(select(CalendarEvent).where(
            CalendarEvent.id == args["event_id"], CalendarEvent.user_id == ctx["user_id"]
        ))).scalar_one_or_none()
        if not event:
            return {"status": "error", "message": "That calendar event was not found in your account."}
        for field in ("title", "location", "description"):
            if field in args and args[field] is not None:
                setattr(event, field, args[field])
        for field in ("start_time", "end_time"):
            if args.get(field):
                setattr(event, field, self._parse_datetime(args[field]))
        if event.end_time <= event.start_time:
            return {"status": "error", "message": "End time must be later than start time."}
        await db.commit()
        return {"status": "success", "action": "updated", "id": event.id, "title": event.title}

    async def _mock_get_assignments(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "success",
            "assignments": [
                {"course": "PHY201", "title": "Problem Set 4: Dirac Notation", "due": "2026-11-06T23:59:00Z"},
                {"course": "MTH311", "title": "Real Analysis Assignment 3", "due": "2026-11-08T17:00:00Z"}
            ]
        }

    async def _mock_get_announcements(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        db = ctx.get("db")
        if db is None:
            return {"status": "unavailable", "message": "Announcements database is unavailable."}
        rows = (await db.execute(select(Notification).where(
            Notification.recipient_id == ctx["user_id"],
            Notification.notification_type.in_([NotificationType.COURSE_ANNOUNCEMENT, NotificationType.SYSTEM_ANNOUNCEMENT]),
        ).order_by(Notification.created_at.desc()).limit(30))).scalars().all()
        return {"status": "success", "announcements": [{"id": item.id, "title": item.title, "content": item.content,
                                                             "link": item.link, "date": item.created_at.isoformat(), "is_read": item.is_read}
                                                            for item in rows]}

    async def _mock_draft_email(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "unavailable",
            "message": "Email integration is not connected, so nothing was saved or sent.",
            "recipient": args.get("recipient_email"),
            "subject": args.get("subject"),
        }

    async def _mock_send_communication(self, args: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "unavailable",
            "message": "External email delivery is not connected. Nothing was sent.",
        }

tool_registry = ToolRegistry()
