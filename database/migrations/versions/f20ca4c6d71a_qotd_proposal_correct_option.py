"""Store the proposed correct option explicitly.

Revision ID: f20ca4c6d71a
Revises: c19b0a2d7f54
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f20ca4c6d71a"
down_revision: Union[str, None] = "c19b0a2d7f54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "correct_option" not in {column["name"] for column in inspector.get_columns("daily_question_proposals")}:
        op.add_column("daily_question_proposals", sa.Column("correct_option", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "correct_option" in {column["name"] for column in inspector.get_columns("daily_question_proposals")}:
        with op.batch_alter_table("daily_question_proposals") as batch_op:
            batch_op.drop_column("correct_option")
