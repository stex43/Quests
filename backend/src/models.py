import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Arc(Base):
    __tablename__ = "arcs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Set when the user explicitly seals the arc; cleared on unseal. Never inferred.
    sealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    # Oldest first, matching the client appending new quests; id breaks ties between
    # rows that share the migration's backfill timestamp.
    quests: Mapped[list["Quest"]] = relationship(
        back_populates="arc",
        cascade="all, delete-orphan",
        order_by=lambda: (Quest.created_at, Quest.id),
    )


class Quest(Base):
    __tablename__ = "quests"
    # At most one open instance per repeating series. Partial, so a series' completed
    # history is unconstrained. Not deferrable: writes that swap which instance is open
    # must flush in an order that never has two open at once (see QuestRepository).
    __table_args__ = (
        Index("uq_quests_open_series", "series_id", unique=True, postgresql_where=text("completed = false")),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    arc_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("arcs.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # The completer's local calendar day, resolved server-side on the incomplete -> complete
    # transition from the client's reported UTC offset. Stored as a plain date so it is frozen:
    # it never shifts when the quest is later viewed from another time zone.
    completed_on: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)
    # The occurrence day of a repeating series instance, server-computed from its rule; NULL
    # for plain quests. An open instance due after the viewer's today is listed as upcoming
    # rather than among the arc's quests; one due before it is overdue and simply stays open.
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)
    # Shared by every instance of one series. There is no series table: the instances are the
    # series, so an arc's cascade delete leaves nothing orphaned.
    series_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, default=None, index=True)
    # The rule in its stored form (see src/recurrence.py), copied verbatim to each spawned
    # instance so a weekly anchor_on stays fixed for the whole series. JSON so new rule kinds
    # need no migration.
    recurrence: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    arc: Mapped[Arc] = relationship(back_populates="quests", lazy="raise")
