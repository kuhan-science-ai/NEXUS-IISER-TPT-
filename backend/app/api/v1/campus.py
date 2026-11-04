from typing import Optional, List
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, desc, func

from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.models.file import FileMetadata
from backend.app.models.notification import Notification, NotificationType
from backend.app.models.calendar import CalendarEvent, Task, Note, EventType
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
from backend.app.api.deps import get_current_user
from backend.app.schemas.daily_question import DailyQuestionAnswerCreate, DailyQuestionAnswerCommentCreate, DailyQuestionProposalCreate
from backend.app.services.daily_questions import (
    DailyQuestionAlreadyAnsweredError,
    DailyQuestionMissingError,
    submit_question_answer,
    total_user_question_points,
    user_has_answered_question,
)
from backend.app.services.storage import storage_service

router = APIRouter(prefix="/campus", tags=["Campus & Productivity"])

# Schemas
class CalendarEventCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    event_type: EventType = EventType.PERSONAL
    start_time: datetime
    end_time: datetime
    is_all_day: bool = False
    location: Optional[str] = None

class TaskCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"

class NoteCreate(BaseModel):
    title: str = Field(..., max_length=255)
    content_latex: str = ""

class PulseCreate(BaseModel):
    content: str = Field(..., max_length=500)
    category: str = "general"

class LostFoundCreate(BaseModel):
    item_type: str = Field(..., pattern="^(lost|found)$")
    title: str = Field(..., max_length=150)
    description: str = Field(..., max_length=1000)
    location: str = Field(..., max_length=150)
    contact_info: str = Field(..., max_length=150)

# --- 1. Notifications ---
@router.get("/notifications")
async def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Notification)
        .where(Notification.recipient_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    notifs = res.scalars().all()
    return [
        {
            "id": n.id,
            "type": n.notification_type.value,
            "title": n.title,
            "content": n.content,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifs
    ]

@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Notification).where(
        Notification.id == notif_id, Notification.recipient_id == current_user.id
    )
    notif = (await db.execute(stmt)).scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"message": "Notification marked as read"}

@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Notification).where(
        Notification.recipient_id == current_user.id, Notification.is_read == False
    )
    res = await db.execute(stmt)
    for n in res.scalars().all():
        n.is_read = True
    await db.commit()
    return {"message": "All notifications marked as read"}

# --- 2. Calendar & Productivity ---
@router.get("/calendar")
async def get_calendar_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(CalendarEvent).where(CalendarEvent.user_id == current_user.id)
    if start:
        query = query.where(CalendarEvent.start_time >= start)
    if end:
        query = query.where(CalendarEvent.end_time <= end)
    query = query.order_by(CalendarEvent.start_time)
    res = await db.execute(query)
    return res.scalars().all()

@router.post("/calendar")
async def create_calendar_event(
    req: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    event = CalendarEvent(
        user_id=current_user.id,
        title=req.title,
        description=req.description,
        event_type=req.event_type,
        start_time=req.start_time,
        end_time=req.end_time,
        is_all_day=req.is_all_day,
        location=req.location,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event

@router.get("/tasks")
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Task).where(Task.user_id == current_user.id).order_by(Task.is_completed, Task.due_date)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/tasks")
async def create_task(
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    task = Task(
        user_id=current_user.id,
        title=req.title,
        description=req.description,
        due_date=req.due_date,
        priority=req.priority,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

@router.put("/tasks/{task_id}/toggle")
async def toggle_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = not task.is_completed
    await db.commit()
    return {"message": "Task toggled", "is_completed": task.is_completed}

@router.get("/notes")
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Note).where(Note.user_id == current_user.id).order_by(desc(Note.updated_at))
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/notes")
async def create_note(
    req: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    note = Note(
        user_id=current_user.id,
        title=req.title,
        content_latex=req.content_latex,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

# --- 3. Campus Pulse, Events & Campus Hub ---
@router.get("/pulse")
async def get_campus_pulse(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(CampusPulseItem)
        .options(selectinload(CampusPulseItem.author).selectinload(User.profile))
        .order_by(desc(CampusPulseItem.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [
        {
            "id": i.id,
            "content": i.content,
            "category": i.category,
            "likes_count": i.likes_count,
            "created_at": i.created_at,
            "author_username": i.author.username if i.author else "Anonymous",
            "author_name": i.author.profile.full_name if (i.author and i.author.profile) else (i.author.username if i.author else "Anonymous"),
        }
        for i in items
    ]

@router.post("/pulse")
async def post_pulse_item(
    req: PulseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = CampusPulseItem(
        author_id=current_user.id,
        content=req.content,
        category=req.category,
    )
    db.add(item)
    await db.commit()
    return {"message": "Pulse item posted"}

@router.get("/events")
async def list_campus_events(
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Event).order_by(Event.start_time)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/events/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = (await db.execute(
        select(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        action = "cancelled"
    else:
        reg = EventRegistration(event_id=event_id, user_id=current_user.id)
        db.add(reg)
        action = "confirmed"

    await db.commit()
    return {"message": f"RSVP {action}"}

@router.get("/opportunities")
async def list_opportunities(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Opportunity)
    if category:
        query = query.where(Opportunity.category == category)
    query = query.order_by(Opportunity.deadline)
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/lost-found")
async def list_lost_found(
    item_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(LostFoundItem)
    if item_type:
        query = query.where(LostFoundItem.item_type == item_type)
    query = query.order_by(desc(LostFoundItem.created_at))
    res = await db.execute(query)
    return res.scalars().all()

@router.post("/lost-found")
async def create_lost_found(
    req: LostFoundCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = LostFoundItem(
        user_id=current_user.id,
        item_type=req.item_type,
        title=req.title,
        description=req.description,
        location=req.location,
        contact_info=req.contact_info,
    )
    db.add(item)
    await db.commit()
    return {"message": "Listing published"}

@router.get("/daily-question")
async def get_daily_question(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DailyQuestion).order_by(desc(DailyQuestion.date), desc(DailyQuestion.created_at)).limit(1)
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        return {
            "id": None,
            "date": "Today",
            "category": "Physics",
            "question_latex": "State Schrödinger's time-dependent wave equation: $i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H}\\Psi(\\mathbf{r}, t)$",
            "explanation_latex": "The fundamental postulate of non-relativistic quantum mechanics governing wave packet evolution.",
            "options": ["It describes time evolution of a quantum state", "It gives the probability density directly", "It defines the position operator", "It states conservation of particle number"],
            "points": 10,
            "answered_count": 0,
            "user_answer": None,
            "total_points": 0,
        }
    answered_count = await db.scalar(select(func.count(DailyQuestionAnswer.id)).where(DailyQuestionAnswer.question_id == q.id)) or 0
    user_answer = (await db.execute(select(DailyQuestionAnswer).where(
        DailyQuestionAnswer.question_id == q.id, DailyQuestionAnswer.user_id == current_user.id
    ))).scalar_one_or_none()
    total_points = await total_user_question_points(current_user.id, db)
    return {
        "id": q.id,
        "date": q.date,
        "category": q.category,
        "question_latex": q.question_latex,
        "explanation_latex": q.explanation_latex,
        "options": json.loads(q.options_json or '["Option A", "Option B", "Option C", "Option D"]'),
        "points": q.points,
        "answered_count": answered_count,
        "user_answer": ({"id": user_answer.id, "answer_latex": user_answer.answer_latex,
                         "selected_option": user_answer.selected_option,
                         "attachment_file_id": user_answer.attachment_file_id,
                         "points_awarded": user_answer.points_awarded, "submitted_at": user_answer.submitted_at}
                        if user_answer else None),
        "total_points": total_points,
    }


async def _user_has_answered(question_id: str, user_id: str, db: AsyncSession) -> bool:
    return await user_has_answered_question(question_id, user_id, db)


@router.get("/daily-questions")
async def list_daily_questions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    questions = (await db.execute(select(DailyQuestion).order_by(desc(DailyQuestion.date), desc(DailyQuestion.created_at)))).scalars().all()
    items = []
    for question in questions:
        count = await db.scalar(select(func.count(DailyQuestionAnswer.id)).where(DailyQuestionAnswer.question_id == question.id)) or 0
        items.append({"id": question.id, "date": question.date, "category": question.category,
                      "question_latex": question.question_latex, "explanation_latex": question.explanation_latex,
                      "options": json.loads(question.options_json or '["Option A", "Option B", "Option C", "Option D"]'),
                      "points": question.points, "answered_count": count})
    return items


@router.post("/daily-question-proposals", status_code=status.HTTP_201_CREATED)
async def create_daily_question_proposal(
    req: DailyQuestionProposalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    options = [option.strip() for option in req.options]
    if any(not option for option in options):
        raise HTTPException(status_code=422, detail="All four LaTeX answer options are required")
    proposal = DailyQuestionProposal(
        user_id=current_user.id,
        category=req.category.strip(),
        question_latex=req.question_latex.strip(),
        options_json=json.dumps(options, ensure_ascii=False),
        correct_option=req.correct_option,
        explanation_latex=req.explanation_latex.strip(),
        template_notes=req.template_notes.strip(),
        animation_notes=req.animation_notes.strip(),
    )
    db.add(proposal)
    await db.flush()
    option_lines = "\n".join(f"{index + 1}. {value}" for index, value in enumerate(options))
    notification_content = (
        f"From: {current_user.username}\n"
        f"Category: {proposal.category}\n\nQuestion (LaTeX):\n{proposal.question_latex}\n\n"
        f"Options (LaTeX):\n{option_lines}\nCorrect option: {chr(65 + proposal.correct_option)}\n\nExpected solution (LaTeX):\n{proposal.explanation_latex}\n\n"
        f"Template request:\n{proposal.template_notes or 'No template notes provided.'}\n\n"
        f"Animation notes:\n{proposal.animation_notes or 'No animation notes provided.'}"
    )
    admins = (await db.execute(select(User).where(User.role.in_([UserRole.ADMINISTRATOR, UserRole.MODERATOR])))).scalars().all()
    notified_reviewers = 0
    for admin in admins:
        db.add(Notification(
            recipient_id=admin.id,
            actor_id=current_user.id,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT,
            title=f"New QOTD proposal · {proposal.category}",
            content=notification_content,
            link=f"/qotd/review?proposal={proposal.id}",
        ))
        notified_reviewers += 1
    await db.commit()
    await db.refresh(proposal)
    return {"id": proposal.id, "status": proposal.status, "submitted_at": proposal.submitted_at, "notified_reviewers": notified_reviewers}


@router.get("/daily-question-proposals")
async def list_daily_question_proposals(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {UserRole.ADMINISTRATOR, UserRole.MODERATOR}:
        raise HTTPException(status_code=403, detail="Only QOTD reviewers can view creator applications")
    proposals = (await db.execute(
        select(DailyQuestionProposal).options(selectinload(DailyQuestionProposal.author).selectinload(User.profile))
        .order_by(desc(DailyQuestionProposal.submitted_at)).limit(100)
    )).scalars().all()
    results = []
    for proposal in proposals:
        author = proposal.author
        name = author.profile.display_name or author.profile.full_name if author and author.profile else (author.username if author else "Student")
        results.append({
            "id": proposal.id,
            "author_name": name,
            "category": proposal.category,
            "question_latex": proposal.question_latex,
            "options": json.loads(proposal.options_json),
            "correct_option": proposal.correct_option,
            "explanation_latex": proposal.explanation_latex,
            "template_notes": proposal.template_notes,
            "animation_notes": proposal.animation_notes,
            "status": proposal.status,
            "submitted_at": proposal.submitted_at,
        })
    return results


@router.post("/daily-questions/{question_id}/answers", status_code=status.HTTP_201_CREATED)
async def submit_daily_question_answer(
    question_id: str, req: DailyQuestionAnswerCreate,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    answer_text = req.answer_latex.strip()
    if not answer_text:
        raise HTTPException(status_code=422, detail="Answer cannot be blank")
    try:
        answer = await submit_question_answer(question_id, current_user.id, answer_text, req.selected_option, req.attachment_file_id, db)
    except DailyQuestionMissingError as exc:
        raise HTTPException(status_code=404, detail="Question not found") from exc
    except DailyQuestionAlreadyAnsweredError as exc:
        raise HTTPException(status_code=409, detail="You have already submitted an answer to this question") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    total_points = await total_user_question_points(current_user.id, db)
    return {"id": answer.id, "question_id": answer.question_id, "answer_latex": answer.answer_latex,
            "selected_option": answer.selected_option, "attachment_file_id": answer.attachment_file_id,
            "points_awarded": answer.points_awarded, "total_points": total_points, "submitted_at": answer.submitted_at}


@router.get("/daily-questions/{question_id}/answers")
async def list_daily_question_answers(
    question_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not await _user_has_answered(question_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Submit your answer before viewing community answers")
    stmt = (select(DailyQuestionAnswer)
            .options(selectinload(DailyQuestionAnswer.author).selectinload(User.profile),
                     selectinload(DailyQuestionAnswer.comments).selectinload(DailyQuestionAnswerComment.author).selectinload(User.profile))
            .where(DailyQuestionAnswer.question_id == question_id, DailyQuestionAnswer.user_id != current_user.id)
            .order_by(desc(DailyQuestionAnswer.submitted_at)))
    answers = (await db.execute(stmt)).scalars().all()
    results = []
    for answer in answers:
        author_name = answer.author.profile.display_name or answer.author.profile.full_name if answer.author and answer.author.profile else (answer.author.username if answer.author else "Student")
        comments = []
        for comment in answer.comments:
            commenter_name = comment.author.profile.display_name or comment.author.profile.full_name if comment.author and comment.author.profile else (comment.author.username if comment.author else "Student")
            comments.append({"id": comment.id, "parent_comment_id": comment.parent_comment_id,
                             "author_name": commenter_name, "content": comment.content, "created_at": comment.created_at})
        results.append({"id": answer.id, "author_name": author_name, "answer_latex": answer.answer_latex,
                        "selected_option": answer.selected_option,
                        "attachment_file_id": answer.attachment_file_id,
                        "points_awarded": answer.points_awarded, "submitted_at": answer.submitted_at, "comments": comments})
    return results


@router.get("/daily-questions/{question_id}/answers/{answer_id}/attachment")
async def download_daily_question_answer_attachment(
    question_id: str, answer_id: str,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if not await _user_has_answered(question_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Submit your answer before viewing community attachments")
    answer = await db.get(DailyQuestionAnswer, answer_id)
    if not answer or answer.question_id != question_id or not answer.attachment_file_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    attachment = await db.get(FileMetadata, answer.attachment_file_id)
    if not attachment or attachment.file_category != "daily-question-answers":
        raise HTTPException(status_code=404, detail="Attachment not found")
    abs_path = storage_service.get_absolute_path(attachment.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Attachment data missing on disk")
    return FileResponse(path=str(abs_path), media_type="application/pdf", filename=attachment.filename)


@router.post("/daily-questions/{question_id}/answers/{answer_id}/comments", status_code=status.HTTP_201_CREATED)
async def comment_on_daily_question_answer(
    question_id: str, answer_id: str, req: DailyQuestionAnswerCommentCreate,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not await _user_has_answered(question_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="Submit your answer before joining the discussion")
    answer = await db.get(DailyQuestionAnswer, answer_id)
    if not answer or answer.question_id != question_id:
        raise HTTPException(status_code=404, detail="Answer not found")
    if req.parent_comment_id:
        parent = await db.get(DailyQuestionAnswerComment, req.parent_comment_id)
        if not parent or parent.answer_id != answer_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    comment_text = req.content.strip()
    if not comment_text:
        raise HTTPException(status_code=422, detail="Comment cannot be blank")
    comment = DailyQuestionAnswerComment(answer_id=answer_id, user_id=current_user.id,
                                         parent_comment_id=req.parent_comment_id, content=comment_text)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {"id": comment.id, "answer_id": answer_id, "parent_comment_id": comment.parent_comment_id,
            "content": comment.content, "created_at": comment.created_at}
