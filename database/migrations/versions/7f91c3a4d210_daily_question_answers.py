"""Persist daily question submissions and gated discussions.

Revision ID: 7f91c3a4d210
Revises: 2bc2c2624ca2
Create Date: 2026-11-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f91c3a4d210"
down_revision: Union[str, None] = "2bc2c2624ca2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("daily_questions", sa.Column("points", sa.Integer(), nullable=False, server_default="10"))
    op.create_table(
        "daily_question_answers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("answer_latex", sa.Text(), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["daily_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("question_id", "user_id", name="uq_daily_question_answer_user"),
    )
    op.create_index("ix_daily_question_answers_id", "daily_question_answers", ["id"])
    op.create_index("ix_daily_question_answers_question_id", "daily_question_answers", ["question_id"])
    op.create_index("ix_daily_question_answers_user_id", "daily_question_answers", ["user_id"])
    op.create_table(
        "daily_question_answer_comments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("answer_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("parent_comment_id", sa.String(length=36), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["answer_id"], ["daily_question_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_comment_id"], ["daily_question_answer_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_daily_question_answer_comments_id", "daily_question_answer_comments", ["id"])
    op.create_index("ix_daily_question_answer_comments_answer_id", "daily_question_answer_comments", ["answer_id"])
    op.create_index("ix_daily_question_answer_comments_user_id", "daily_question_answer_comments", ["user_id"])
    op.create_index("ix_daily_question_answer_comments_parent_comment_id", "daily_question_answer_comments", ["parent_comment_id"])


def downgrade() -> None:
    op.drop_index("ix_daily_question_answer_comments_parent_comment_id", table_name="daily_question_answer_comments")
    op.drop_index("ix_daily_question_answer_comments_user_id", table_name="daily_question_answer_comments")
    op.drop_index("ix_daily_question_answer_comments_answer_id", table_name="daily_question_answer_comments")
    op.drop_index("ix_daily_question_answer_comments_id", table_name="daily_question_answer_comments")
    op.drop_table("daily_question_answer_comments")
    op.drop_index("ix_daily_question_answers_user_id", table_name="daily_question_answers")
    op.drop_index("ix_daily_question_answers_question_id", table_name="daily_question_answers")
    op.drop_index("ix_daily_question_answers_id", table_name="daily_question_answers")
    op.drop_table("daily_question_answers")
    op.drop_column("daily_questions", "points")
