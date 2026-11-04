"""Add answer choices and private PDF attachments for daily quizzes.

Revision ID: a82c50b17e21
Revises: 7f91c3a4d210
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a82c50b17e21"
down_revision: Union[str, None] = "7f91c3a4d210"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("daily_questions", sa.Column("options_json", sa.Text(), nullable=False, server_default='["Option A", "Option B", "Option C", "Option D"]'))
    op.add_column("daily_question_answers", sa.Column("selected_option", sa.Integer(), nullable=False, server_default="0"))
    with op.batch_alter_table("daily_question_answers") as batch:
        batch.add_column(sa.Column("attachment_file_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key("fk_daily_question_answers_attachment_file_id", "file_metadata", ["attachment_file_id"], ["id"], ondelete="SET NULL")
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE daily_questions SET options_json = :choices WHERE category = 'Physics' AND question_latex LIKE '%harmonic oscillator%'"), {
        "choices": '["One-half ħω", "ħω", "Zero", "Three-halves ħω"]'
    })


def downgrade() -> None:
    with op.batch_alter_table("daily_question_answers") as batch:
        batch.drop_constraint("fk_daily_question_answers_attachment_file_id", type_="foreignkey")
        batch.drop_column("attachment_file_id")
    op.drop_column("daily_question_answers", "selected_option")
    op.drop_column("daily_questions", "options_json")
