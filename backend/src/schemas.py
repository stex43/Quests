import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ConstrainedStr = Annotated[str, Field(min_length=1, max_length=100)]
ConstrainedText = Annotated[str, Field(min_length=1, max_length=1000)]


class QuestCreate(BaseModel):
    title: ConstrainedStr
    description: ConstrainedText


class QuestUpdate(BaseModel):
    # Fields default to None solely for omission detection via model_fields_set.
    # Explicit null (e.g. {"title": null}) is rejected with 400 by the route handler.
    title: ConstrainedStr | None = None
    description: ConstrainedText | None = None
    arc_id: uuid.UUID | None = None


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
