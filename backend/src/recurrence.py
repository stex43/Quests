"""Recurrence engine: pure date arithmetic for repeating quests, no DB access.

A rule is stored on each series instance in its "stored" form: the client's rule plus any
server-set state the schedule needs. Today that is only the weekly anchor_on, which fixes
which weeks an every-N-weeks cadence lands on. Clients never see or set it;
schemas.WeeklyRule has no such field, so the API form drops it on output.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Annotated, assert_never

from pydantic import Field, TypeAdapter

from src.schemas import DailyRule, RecurrenceRule, WeeklyRule


class StoredWeeklyRule(WeeklyRule):
    anchor_on: date


StoredRule = Annotated[DailyRule | StoredWeeklyRule, Field(discriminator="frequency")]

_stored_rule_adapter = TypeAdapter(StoredRule)


def local_today(utc_offset_minutes: int | None) -> date:
    # The instant is server-generated; the client only says how far east of UTC it sits,
    # which turns that instant into the client's own calendar day. Without an offset the
    # UTC day is the best available answer.
    return (datetime.now(UTC) + timedelta(minutes=utc_offset_minutes or 0)).date()


def to_stored(rule: RecurrenceRule, today: date) -> StoredRule:
    if isinstance(rule, WeeklyRule):
        # Anchored on the first listed weekday on or after today, so the first occurrence is
        # always the next matching day: "every 2 weeks on Mon" set on a Tuesday is due in 6
        # days, not 13. Anchoring on today itself would make its week the "on" week, and a
        # weekday already past in it would push the first occurrence a whole interval out.
        anchor_on = next(
            day for day in (today + timedelta(days=offset) for offset in range(7)) if day.weekday() in rule.weekdays
        )
        return StoredWeeklyRule(**rule.model_dump(), anchor_on=anchor_on)
    return rule


def load_stored(data: dict) -> StoredRule:
    return _stored_rule_adapter.validate_python(data)


def dump_stored(rule: StoredRule) -> dict:
    # JSON mode so anchor_on lands in the JSONB column as an ISO date string.
    return rule.model_dump(mode="json")


def _monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def first_on_or_after(rule: StoredRule, day: date) -> date:
    """The first date on or after `day` that the rule lands on."""
    if isinstance(rule, DailyRule):
        return day
    if isinstance(rule, StoredWeeklyRule):
        # Weeks count from the anchor's Monday; only every interval-th week is "on".
        # Any 7 * interval consecutive days hold each weekday in interval consecutive
        # weeks, i.e. once per phase, so the scan always finds a match.
        anchor_monday = _monday(rule.anchor_on)
        for offset in range(7 * rule.interval):
            candidate = day + timedelta(days=offset)
            weeks_from_anchor = (_monday(candidate) - anchor_monday).days // 7
            if candidate.weekday() in rule.weekdays and weeks_from_anchor % rule.interval == 0:
                return candidate
        raise AssertionError("unreachable: a weekly rule with at least one weekday always matches")
    assert_never(rule)


def next_after(rule: StoredRule, day: date) -> date:
    """The first date strictly after `day` that the rule lands on."""
    return first_on_or_after(rule, day + timedelta(days=1))
