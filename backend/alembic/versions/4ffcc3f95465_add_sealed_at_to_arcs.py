"""add sealed_at to arcs

Revision ID: 4ffcc3f95465
Revises: d2ccfda40961
Create Date: 2026-09-28 21:37:32.677364

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4ffcc3f95465"
down_revision: str | Sequence[str] | None = "d2ccfda40961"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("arcs", sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("arcs", "sealed_at")
