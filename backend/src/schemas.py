import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ConstrainedStr = Annotated[str, Field(min_length=1, max_length=100)]
ConstrainedText = Annotated[str, Field(min_length=1, max_length=1000)]


class QuestCreate(BaseModel):
    title: ConstrainedStr
    description: ConstrainedText
    arc_id: uuid.UUID


class QuestUpdate(BaseModel):
    title: ConstrainedStr
    description: ConstrainedText
    arc_id: uuid.UUID


class Quest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    arc_id: uuid.UUID


class ArcCreate(BaseModel):
    title: ConstrainedStr


class ArcUpdate(BaseModel):
    title: ConstrainedStr


class Arc(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str


class ArcExtended(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    quests: list[Quest] = []
