"""Add optional cover and banner art to academic resources.

Revision ID: 5c71a9d42e30
Revises: 39a6d814b2f1
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "5c71a9d42e30"
down_revision: Union[str, None] = "39a6d814b2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("academic_resources")}
    if "thumbnail_file_id" not in existing:
        op.add_column("academic_resources", sa.Column("thumbnail_file_id", sa.String(length=36), sa.ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True))
    if "banner_file_id" not in existing:
        op.add_column("academic_resources", sa.Column("banner_file_id", sa.String(length=36), sa.ForeignKey("file_metadata.id", ondelete="SET NULL"), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("academic_resources") as batch_op:
        batch_op.drop_column("banner_file_id")
        batch_op.drop_column("thumbnail_file_id")
