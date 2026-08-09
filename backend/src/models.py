import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Arc(Base):
    __tablename__ = "arcs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    quests: Mapped[list["Quest"]] = relationship(back_populates="arc", cascade="all, delete-orphan")


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

    arc: Mapped[Arc] = relationship(back_populates="quests", lazy="raise")
