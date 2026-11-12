"""Store repository metadata and account-specific recent views.

Revision ID: 39a6d814b2f1
Revises: f20ca4c6d71a
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "39a6d814b2f1"
down_revision: Union[str, None] = "f20ca4c6d71a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {column["name"] for column in inspector.get_columns("academic_resources")}
    for name, column in (
        ("subject_code", sa.Column("subject_code", sa.String(length=40), nullable=True)),
        ("publisher_name", sa.Column("publisher_name", sa.String(length=120), nullable=True)),
        ("pages", sa.Column("pages", sa.Integer(), nullable=False, server_default="1")),
        ("size_bytes", sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0")),
    ):
        if name not in existing:
            op.add_column("academic_resources", column)
    op.create_table(
        "resource_views",
        sa.Column("resource_id", sa.String(length=36), sa.ForeignKey("academic_resources.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("resource_views")
    with op.batch_alter_table("academic_resources") as batch:
        batch.drop_column("size_bytes")
        batch.drop_column("pages")
        batch.drop_column("publisher_name")
        batch.drop_column("subject_code")
