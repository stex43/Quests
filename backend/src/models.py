import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Arc(Base):
    __tablename__ = "arcs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Oldest first, matching the client appending new quests; id breaks ties between
    # rows that share the migration's backfill timestamp.
    quests: Mapped[list["Quest"]] = relationship(
        back_populates="arc",
        cascade="all, delete-orphan",
        order_by=lambda: (Quest.created_at, Quest.id),
    )


class Quest(Base):
    __tablename__ = "quests"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    arc_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("arcs.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # The completer's local calendar day, resolved server-side on the incomplete -> complete
    # transition from the client's reported UTC offset. Stored as a plain date so it is frozen:
    # it never shifts when the quest is later viewed from another time zone.
    completed_on: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    arc: Mapped[Arc] = relationship(back_populates="quests", lazy="raise")
