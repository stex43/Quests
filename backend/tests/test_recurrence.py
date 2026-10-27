from datetime import UTC, date, datetime, timedelta

import pytest

from src import recurrence
from src.recurrence import StoredWeeklyRule, first_on_or_after, next_after
from src.schemas import DailyRule, WeeklyRule

MON, TUE, WED, THU, FRI, SAT, SUN = range(7)


def _weekly(weekdays: list[int], interval: int = 1, anchor_on: date = date(2026, 10, 26)) -> StoredWeeklyRule:
    return StoredWeeklyRule(frequency="weekly", interval=interval, weekdays=weekdays, anchor_on=anchor_on)


def test_daily_first_on_or_after_is_the_day_itself():
    assert first_on_or_after(DailyRule(frequency="daily"), date(2026, 10, 27)) == date(2026, 10, 27)


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 10, 27), date(2026, 10, 28)),
        (date(2026, 10, 31), date(2026, 11, 1)),
        (date(2026, 12, 31), date(2027, 1, 1)),
        (date(2028, 2, 28), date(2028, 2, 29)),
    ],
)
def test_daily_next_after_crosses_month_and_year_boundaries(day, expected):
    assert next_after(DailyRule(frequency="daily"), day) == expected


def test_weekly_first_on_or_after_returns_day_when_it_matches():
    # 2026-10-30 is a Friday.
    assert first_on_or_after(_weekly([FRI]), date(2026, 10, 30)) == date(2026, 10, 30)


def test_weekly_first_on_or_after_moves_to_next_matching_weekday():
    # Set on a Tuesday, "weekly on Fri" first lands on that week's Friday.
    assert first_on_or_after(_weekly([FRI]), date(2026, 10, 27)) == date(2026, 10, 30)


def test_weekly_multiple_weekdays_alternate():
    rule = _weekly([MON, FRI])
    assert first_on_or_after(rule, date(2026, 10, 27)) == date(2026, 10, 30)
    assert next_after(rule, date(2026, 10, 30)) == date(2026, 11, 2)
    assert next_after(rule, date(2026, 11, 2)) == date(2026, 11, 6)


def test_weekly_next_after_crosses_month_and_year_boundaries():
    rule = _weekly([MON])
    assert next_after(rule, date(2026, 1, 30)) == date(2026, 2, 2)
    assert next_after(rule, date(2026, 12, 28)) == date(2027, 1, 4)
    assert next_after(rule, date(2026, 12, 31)) == date(2027, 1, 4)


def test_every_four_weeks_follows_anchor_phase():
    # Anchored in the week of Mon 2026-10-26: only that week and every 4th one after are "on".
    rule = _weekly([WED], interval=4, anchor_on=date(2026, 10, 27))
    assert first_on_or_after(rule, date(2026, 10, 26)) == date(2026, 10, 28)
    assert next_after(rule, date(2026, 10, 28)) == date(2026, 11, 25)
    # From an "off" week, the scan skips ahead to the next "on" week.
    assert first_on_or_after(rule, date(2026, 11, 2)) == date(2026, 11, 25)


def test_to_stored_anchors_weekly_on_first_matching_day():
    # Set on the matching day itself: anchored on today.
    stored = recurrence.to_stored(WeeklyRule(frequency="weekly", weekdays=[TUE]), date(2026, 10, 27))
    assert stored.anchor_on == date(2026, 10, 27)
    # Set on a Tuesday for Mon+Thu: anchored on that Thursday, not the next Monday.
    stored = recurrence.to_stored(WeeklyRule(frequency="weekly", weekdays=[MON, THU]), date(2026, 10, 27))
    assert stored.anchor_on == date(2026, 10, 29)


def test_every_2_weeks_mon_set_on_tuesday_is_due_next_monday():
    # Tue 2026-10-27: the first occurrence is 6 days out, the following one 2 weeks after it.
    today = date(2026, 10, 27)
    stored = recurrence.to_stored(WeeklyRule(frequency="weekly", interval=2, weekdays=[MON]), today)
    first = first_on_or_after(stored, today)
    assert first == date(2026, 11, 2)
    assert next_after(stored, first) == date(2026, 11, 16)


def test_every_4_weeks_wed_set_on_thursday_is_due_next_wednesday():
    # Thu 2026-10-29: the next Wednesday, not one 4 weeks later.
    today = date(2026, 10, 29)
    stored = recurrence.to_stored(WeeklyRule(frequency="weekly", interval=4, weekdays=[WED]), today)
    first = first_on_or_after(stored, today)
    assert first == date(2026, 11, 4)
    assert next_after(stored, first) == date(2026, 12, 2)


def test_every_n_weeks_phase_holds_before_the_anchor():
    # Weeks before the anchor follow the same phase (floor division, non-negative modulo).
    rule = _weekly([MON], interval=2, anchor_on=date(2026, 10, 26))
    assert first_on_or_after(rule, date(2026, 10, 12)) == date(2026, 10, 12)
    assert first_on_or_after(rule, date(2026, 10, 19)) == date(2026, 10, 26)


def test_every_n_weeks_phase_stays_fixed_over_many_occurrences():
    anchor = date(2026, 10, 26)
    rule = _weekly([TUE, SAT], interval=3, anchor_on=anchor)
    day = first_on_or_after(rule, anchor)
    for _ in range(50):
        assert day.weekday() in (TUE, SAT)
        assert ((day - timedelta(days=day.weekday()) - anchor).days // 7) % 3 == 0
        day = next_after(rule, day)


def test_every_52_weeks_finds_a_match():
    rule = _weekly([SUN], interval=52, anchor_on=date(2026, 10, 26))
    assert next_after(rule, date(2026, 11, 1)) == date(2027, 10, 31)


def test_weekly_rule_weekdays_are_deduplicated_and_sorted():
    rule = WeeklyRule(frequency="weekly", weekdays=[FRI, MON, FRI])
    assert rule.weekdays == [MON, FRI]
    assert rule.interval == 1


def test_stored_rule_round_trips_through_json():
    stored = recurrence.to_stored(WeeklyRule(frequency="weekly", interval=2, weekdays=[TUE]), date(2026, 10, 27))
    data = recurrence.dump_stored(stored)
    assert data == {"frequency": "weekly", "interval": 2, "weekdays": [TUE], "anchor_on": "2026-10-27"}
    assert recurrence.load_stored(data) == stored


def test_daily_rule_stored_form_has_no_anchor():
    stored = recurrence.to_stored(DailyRule(frequency="daily"), date(2026, 10, 27))
    assert recurrence.dump_stored(stored) == {"frequency": "daily"}


def test_local_today_applies_offset(monkeypatch):
    frozen_now = datetime(2026, 10, 27, 23, 30, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now

    monkeypatch.setattr(recurrence, "datetime", _FrozenDatetime)
    assert recurrence.local_today(None) == date(2026, 10, 27)
    assert recurrence.local_today(60) == date(2026, 10, 28)
    assert recurrence.local_today(-840) == date(2026, 10, 27)
