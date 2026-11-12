"""Store optional resource card animation settings.

Revision ID: 7e3a9c1f42b6
Revises: 5c71a9d42e30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7e3a9c1f42b6"
down_revision: Union[str, None] = "5c71a9d42e30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("academic_resources")}
    if "animation" not in existing:
        op.add_column("academic_resources", sa.Column("animation", sa.String(20), nullable=False, server_default="none"))
    if "animation_color" not in existing:
        op.add_column("academic_resources", sa.Column("animation_color", sa.String(7), nullable=False, server_default="#ff6a00"))


def downgrade() -> None:
    with op.batch_alter_table("academic_resources") as batch_op:
        batch_op.drop_column("animation_color")
        batch_op.drop_column("animation")
