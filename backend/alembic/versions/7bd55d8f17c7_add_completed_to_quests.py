"""add completed to quests

Revision ID: 7bd55d8f17c7
Revises: 675a6f5cea0f
Create Date: 2026-07-26 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7bd55d8f17c7"
down_revision: str | Sequence[str] | None = "675a6f5cea0f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("quests", sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("quests", "completed", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("quests", "completed")
