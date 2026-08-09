import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src import models


class ArcRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, title: str) -> models.Arc:
        arc = models.Arc(title=title)
        self.db.add(arc)
        return arc

    def get_all(self) -> list[models.Arc]:
        return list(self.db.scalars(select(models.Arc).options(selectinload(models.Arc.quests))).all())

    def get(self, arc_id: uuid.UUID) -> models.Arc | None:
        return self.db.get(models.Arc, arc_id)

    def update(self, arc: models.Arc, title: str) -> None:
        arc.title = title

    def delete(self, arc: models.Arc) -> None:
        self.db.delete(arc)


class QuestRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, title: str, description: str, arc_id: uuid.UUID) -> models.Quest:
        quest = models.Quest(title=title, description=description, arc_id=arc_id)
        self.db.add(quest)
        return quest

    def get(self, quest_id: uuid.UUID) -> models.Quest | None:
        return self.db.get(models.Quest, quest_id)

    def get_by_arc(self, arc_id: uuid.UUID) -> list[models.Quest]:
        return list(self.db.scalars(select(models.Quest).where(models.Quest.arc_id == arc_id)).all())

    def update(self, quest: models.Quest, title: str | None, description: str | None, arc_id: uuid.UUID | None) -> None:
        # None means "omitted — skip this field". Callers must reject explicit null before calling this.
        if title is not None:
            quest.title = title
        if description is not None:
            quest.description = description
        if arc_id is not None:
            quest.arc_id = arc_id

    def complete(self, quest: models.Quest, utc_offset_minutes: int | None = None) -> models.Quest:
        # Only stamp on the incomplete -> complete transition, so re-completing an
        # already-completed quest preserves the original date.
        if quest.completed:
            return quest
        quest.completed = True
        # The instant is server-generated; the client only says how far east of UTC it sits,
        # which turns that instant into the completer's own calendar day. Without an offset
        # the UTC day is the best available answer.
        now = datetime.now(UTC)
        if utc_offset_minutes is not None:
            now += timedelta(minutes=utc_offset_minutes)
        quest.completed_on = now.date()
        return quest

    def uncomplete(self, quest: models.Quest) -> models.Quest:
        # Cleared unconditionally: also heals rows whose flag and date disagree.
        quest.completed = False
        quest.completed_on = None
        return quest

    def delete(self, quest: models.Quest) -> None:
        self.db.delete(quest)
