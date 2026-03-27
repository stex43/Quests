import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src import models


class ArcRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, title: str) -> models.Arc:
        arc = models.Arc(title=title)
        self.db.add(arc)
        self.db.commit()
        self.db.refresh(arc)
        return arc

    def get_all(self) -> list[models.Arc]:
        return list(self.db.scalars(select(models.Arc).options(selectinload(models.Arc.quests))).all())

    def get(self, arc_id: uuid.UUID) -> models.Arc | None:
        return self.db.get(models.Arc, arc_id)

    def update(self, arc: models.Arc, title: str) -> None:
        arc.title = title
        self.db.commit()
        self.db.refresh(arc)

    def delete(self, arc: models.Arc) -> None:
        self.db.delete(arc)
        self.db.commit()


class QuestRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, title: str, description: str, arc_id: uuid.UUID) -> models.Quest:
        quest = models.Quest(title=title, description=description, arc_id=arc_id)
        self.db.add(quest)
        self.db.commit()
        self.db.refresh(quest)
        return quest

    def get(self, quest_id: uuid.UUID) -> models.Quest | None:
        return self.db.get(models.Quest, quest_id)

    def update(self, quest: models.Quest, title: str, description: str, arc_id: uuid.UUID) -> None:
        quest.title = title
        quest.description = description
        quest.arc_id = arc_id
        self.db.commit()
        self.db.refresh(quest)

    def delete(self, quest: models.Quest) -> None:
        self.db.delete(quest)
        self.db.commit()
