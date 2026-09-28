"""add created_at to arcs and quests

Revision ID: d2ccfda40961
Revises: cee67089d78b
Create Date: 2026-09-28 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2ccfda40961"
down_revision: str | Sequence[str] | None = "cee67089d78b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Gives lists a stable order. Existing rows are backfilled with the migration's own
    # timestamp, so they all tie; the queries break ties on id.
    op.add_column(
        "arcs",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column(
        "quests",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("quests", "created_at")
    op.drop_column("arcs", "created_at")
