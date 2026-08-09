"""add completed_on to quests

Revision ID: cee67089d78b
Revises: 7bd55d8f17c7
Create Date: 2026-08-09 15:13:01.439751

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cee67089d78b"
down_revision: str | Sequence[str] | None = "7bd55d8f17c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # The completer's local calendar day, not a timestamp: a DATE cannot drift between
    # time zones. Left NULL for quests completed before this column existed; the UI
    # renders those as "Completion date unrecorded" rather than inventing a date.
    op.add_column("quests", sa.Column("completed_on", sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("quests", "completed_on")
