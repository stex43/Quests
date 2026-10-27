import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ConstrainedStr = Annotated[str, Field(min_length=1, max_length=100)]

# A client's own UTC offset, in minutes east of UTC (Berlin in summer is +120). It is used to
# resolve the client's calendar day and is never itself persisted. Bounds cover the real-world
# range of UTC-14..UTC+14.
UtcOffsetMinutes = Annotated[int, Field(ge=-840, le=840)]


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict | None = None


class DailyRule(BaseModel):
    frequency: Literal["daily"]


class WeeklyRule(BaseModel):
    frequency: Literal["weekly"]
    # Every N weeks; the cadence's phase comes from a server-set anchor (see src/recurrence.py),
    # which is deliberately not a field here, so a client-sent anchor_on is simply ignored.
    interval: Annotated[int, Field(ge=1, le=52)] = 1
    # Mon=0 .. Sun=6, matching date.weekday().
    weekdays: Annotated[list[Annotated[int, Field(ge=0, le=6)]], Field(min_length=1)]

    @field_validator("weekdays")
    @classmethod
    def normalize_weekdays(cls, v: list[int]) -> list[int]:
        return sorted(set(v))


# Tagged on frequency, so a new pattern (monthly, yearly) is one more model in this union and
# needs no migration: the rule is stored as JSON.
RecurrenceRule = Annotated[DailyRule | WeeklyRule, Field(discriminator="frequency")]


class QuestCreate(BaseModel):
    title: ConstrainedStr
    description: Annotated[str, Field(max_length=1000)] = ""
    # Makes the quest the first instance of a repeating series. The offset resolves "today",
    # from which the first occurrence is computed; it is ignored without a rule.
    recurrence: RecurrenceRule | None = None
    utc_offset_minutes: UtcOffsetMinutes | None = None


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

    # The only thing a client may contribute to completion: its own UTC offset, which
    # resolves the completer's calendar day.
    utc_offset_minutes: UtcOffsetMinutes | None = None


class QuestRecurrenceUpdate(BaseModel):
    # Extras rejected for the same reason as QuestComplete: a misspelled offset must not
    # silently fall back to the UTC day.
    model_config = ConfigDict(extra="forbid")

    recurrence: RecurrenceRule
    utc_offset_minutes: UtcOffsetMinutes | None = None


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
    # Server-managed, set only on series instances: the occurrence day. Serializes as YYYY-MM-DD.
    due_on: date | None = None
    # Groups the instances of one repeating series; null for plain quests.
    series_id: uuid.UUID | None = None
    # The rule as the client set it; the stored weekly anchor_on is not exposed.
    recurrence: RecurrenceRule | None = None


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
    sealed_at: datetime | None = None
    recent_completed: list[Quest] = []
    completed_count: int = 0
    # Active view only: open series instances due after today, soonest first. They are
    # kept out of quests until their due day.
    upcoming: list[Quest] = []


class ArcSealState(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sealed_at: datetime | None


class QuestCompleteResponse(Quest):
    arc_fully_completed: bool
    # The series' next instance, spawned by this completion; null for plain quests and for
    # idempotent re-completion.
    next_instance: Quest | None = None


class QuestUncompleteResponse(Quest):
    # The series' open instance deleted so this one becomes the open instance again; null
    # when there was none.
    removed_instance_id: uuid.UUID | None = None
