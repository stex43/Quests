"""add recurrence to quests

Revision ID: 8a1f3c5d9b72
Revises: 4ffcc3f95465
Create Date: 2026-10-27 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a1f3c5d9b72"
down_revision: str | Sequence[str] | None = "4ffcc3f95465"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # All NULL for existing rows: every quest so far is a plain, non-repeating quest.
    op.add_column("quests", sa.Column("due_on", sa.Date(), nullable=True))
    op.add_column("quests", sa.Column("series_id", sa.UUID(), nullable=True))
    op.add_column("quests", sa.Column("recurrence", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index(op.f("ix_quests_series_id"), "quests", ["series_id"], unique=False)
    # At most one open instance per series; completed instances (the series' history) are unconstrained.
    op.create_index(
        "uq_quests_open_series",
        "quests",
        ["series_id"],
        unique=True,
        postgresql_where=sa.text("completed = false"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("uq_quests_open_series", table_name="quests")
    op.drop_index(op.f("ix_quests_series_id"), table_name="quests")
    op.drop_column("quests", "recurrence")
    op.drop_column("quests", "series_id")
    op.drop_column("quests", "due_on")
