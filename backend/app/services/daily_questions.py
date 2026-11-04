from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.file import FileMetadata

from backend.app.models.campus import DailyQuestion, DailyQuestionAnswer


class DailyQuestionMissingError(Exception):
    pass


class DailyQuestionAlreadyAnsweredError(Exception):
    pass


async def user_has_answered_question(question_id: str, user_id: str, db: AsyncSession) -> bool:
    answer_id = await db.scalar(select(DailyQuestionAnswer.id).where(
        DailyQuestionAnswer.question_id == question_id,
        DailyQuestionAnswer.user_id == user_id,
    ))
    return answer_id is not None


async def submit_question_answer(question_id: str, user_id: str, answer_text: str, selected_option: int, attachment_file_id: str | None, db: AsyncSession) -> DailyQuestionAnswer:
    question = await db.get(DailyQuestion, question_id)
    if not question:
        raise DailyQuestionMissingError
    if await user_has_answered_question(question_id, user_id, db):
        raise DailyQuestionAlreadyAnsweredError
    if attachment_file_id:
        attachment = await db.get(FileMetadata, attachment_file_id)
        if not attachment or attachment.uploader_id != user_id or attachment.file_category != "daily-question-answers" or attachment.mime_type != "application/pdf":
            raise ValueError("Choose a PDF that you uploaded for this answer")

    answer = DailyQuestionAnswer(
        question_id=question_id,
        user_id=user_id,
        answer_latex=answer_text,
        selected_option=selected_option,
        attachment_file_id=attachment_file_id,
        points_awarded=question.points,
    )
    db.add(answer)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # The composite unique constraint protects simultaneous duplicate requests.
        raise DailyQuestionAlreadyAnsweredError from exc
    await db.refresh(answer)
    return answer


async def total_user_question_points(user_id: str, db: AsyncSession) -> int:
    return int(await db.scalar(select(func.coalesce(func.sum(DailyQuestionAnswer.points_awarded), 0)).where(
        DailyQuestionAnswer.user_id == user_id
    )) or 0)
