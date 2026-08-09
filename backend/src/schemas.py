import uuid
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ConstrainedStr = Annotated[str, Field(min_length=1, max_length=100)]
ConstrainedText = Annotated[str, Field(min_length=1, max_length=1000)]


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict | None = None


class QuestCreate(BaseModel):
    title: ConstrainedStr
    description: Annotated[str, Field(max_length=1000)] = ""


class QuestUpdate(BaseModel):
    # Fields default to None solely for omission detection via model_fields_set.
    # Explicit null (e.g. {"title": null}) is rejected with 400 by the route handler.
    title: ConstrainedStr | None = None
    description: Annotated[str, Field(max_length=1000)] | None = None
    arc_id: uuid.UUID | None = None


class QuestComplete(BaseModel):
    # Extras are rejected so a misspelled field is a 400 rather than a silent fallback to
    # the UTC day. Deliberately local to this schema; the other schemas keep Pydantic's
    # default ignore behaviour.
    model_config = ConfigDict(extra="forbid")

    # The only thing a client may contribute to completion: its own UTC offset, in minutes
    # east of UTC (Berlin in summer is +120). It is used to resolve the completer's calendar
    # day and is not itself persisted. Bounds cover the real-world range of UTC-14..UTC+14.
    utc_offset_minutes: Annotated[int, Field(ge=-840, le=840)] | None = None


class Quest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    arc_id: uuid.UUID
    completed: bool
    # Server-managed: set on completion, cleared on un-completion. Not accepted as input.
    # Serializes as YYYY-MM-DD.
    completed_on: date | None = None


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
