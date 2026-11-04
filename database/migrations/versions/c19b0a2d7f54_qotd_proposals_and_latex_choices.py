"""Store QOTD creator applications and format choices as LaTeX.

Revision ID: c19b0a2d7f54
Revises: a82c50b17e21
"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa


revision: str = "c19b0a2d7f54"
down_revision: Union[str, None] = "a82c50b17e21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("daily_question_proposals"):
        op.create_table(
            "daily_question_proposals",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("question_latex", sa.Text(), nullable=False),
            sa.Column("options_json", sa.Text(), nullable=False),
            sa.Column("explanation_latex", sa.Text(), nullable=False),
            sa.Column("template_notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("animation_notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("daily_question_proposals")}
    for name, columns in (
        ("ix_daily_question_proposals_id", ["id"]),
        ("ix_daily_question_proposals_user_id", ["user_id"]),
        ("ix_daily_question_proposals_status", ["status"]),
    ):
        if name not in existing_indexes:
            op.create_index(name, "daily_question_proposals", columns)
    correct_latex_options = [
        r"$E_0 = \frac{1}{2}\hbar\omega$",
        r"$E_0 = \hbar\omega$",
        r"$E_0 = 0$",
        r"$E_0 = \frac{3}{2}\hbar\omega$",
    ]
    op.get_bind().execute(
        sa.text("UPDATE daily_questions SET options_json = :options WHERE category = 'Physics' AND question_latex LIKE '%harmonic oscillator%'"),
        {"options": json.dumps(correct_latex_options, ensure_ascii=False)},
    )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("daily_question_proposals"):
        existing_indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("daily_question_proposals")}
        for name in ("ix_daily_question_proposals_status", "ix_daily_question_proposals_user_id", "ix_daily_question_proposals_id"):
            if name in existing_indexes:
                op.drop_index(name, table_name="daily_question_proposals")
        op.drop_table("daily_question_proposals")
