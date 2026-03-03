import uuid

from pydantic import BaseModel


class QuestCreate(BaseModel):
    title: str
    description: str
    arc_id: uuid.UUID


class QuestUpdate(BaseModel):
    title: str
    description: str
    arc_id: uuid.UUID


class Quest(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    arc_id: uuid.UUID


class ArcCreate(BaseModel):
    # todo: max length
    title: str


class ArcUpdate(BaseModel):
    # todo: max length
    title: str


class Arc(BaseModel):
    id: uuid.UUID
    title: str


class ArcExtended(BaseModel):
    id: uuid.UUID
    title: str
    quests: list[Quest] = []
