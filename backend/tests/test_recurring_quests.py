import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError

from src import models, recurrence
from tests.conftest import assert_error_response

MON, TUE, WED, THU, FRI, SAT, SUN = range(7)
# A Tuesday. Every test runs on a fixed "today" so nothing depends on the real date.
TUESDAY = date(2026, 10, 27)
DAILY = {"frequency": "daily"}


class _Clock:
    def __init__(self, today: date) -> None:
        self.today = today


@pytest.fixture
def clock(monkeypatch) -> _Clock:
    # Every route resolves "today" through recurrence.local_today, so replacing it pins the
    # date for the whole request; tests advance clock.today to simulate later days.
    c = _Clock(TUESDAY)
    monkeypatch.setattr(recurrence, "local_today", lambda utc_offset_minutes: c.today)
    return c


def _weekly(weekdays: list[int], interval: int = 1) -> dict:
    return {"frequency": "weekly", "interval": interval, "weekdays": weekdays}


def _create(client, arc_id, recurrence_rule: dict | None = None, **extra):
    body = {"title": "Water plants", "description": "All of them", **extra}
    if recurrence_rule is not None:
        body["recurrence"] = recurrence_rule
    return client.post(f"/arcs/{arc_id}/quests", json=body)


def _active_arc(client, arc_id, utc_offset_minutes: int | None = None) -> dict:
    url = "/arcs?view=active"
    if utc_offset_minutes is not None:
        url += f"&utc_offset_minutes={utc_offset_minutes}"
    return next(a for a in client.get(url).json() if a["id"] == str(arc_id))


def _ids(quests: list[dict]) -> list[str]:
    return [q["id"] for q in quests]


def _open_in_series(db_session, series_id: str) -> list[models.Quest]:
    db_session.expire_all()
    stmt = select(models.Quest).where(models.Quest.series_id == uuid.UUID(series_id), models.Quest.completed.is_(False))
    return list(db_session.scalars(stmt).all())


# --- creation ---------------------------------------------------------------------------


def test_create_plain_quest_has_no_recurrence_fields(client, clock, make_arc):
    arc = make_arc()
    body = _create(client, arc.id).json()
    assert body["due_on"] is None
    assert body["series_id"] is None
    assert body["recurrence"] is None


def test_create_daily_quest_is_due_today_and_listed(client, clock, make_arc):
    arc = make_arc()
    resp = _create(client, arc.id, DAILY)
    assert resp.status_code == 201
    body = resp.json()
    assert body["due_on"] == "2026-10-27"
    assert body["series_id"] is not None
    assert body["recurrence"] == DAILY

    listing = _active_arc(client, arc.id)
    assert _ids(listing["quests"]) == [body["id"]]
    assert listing["upcoming"] == []


def test_create_weekly_quest_due_later_is_upcoming(client, clock, make_arc):
    arc = make_arc()
    body = _create(client, arc.id, _weekly([FRI])).json()
    # Set on Tuesday, "weekly on Fri" is first due that Friday.
    assert body["due_on"] == "2026-10-30"
    # The server-set anchor is not exposed.
    assert body["recurrence"] == _weekly([FRI])

    listing = _active_arc(client, arc.id)
    assert listing["quests"] == []
    assert _ids(listing["upcoming"]) == [body["id"]]


def test_create_weekly_stores_server_anchor_and_ignores_client_anchor(client, clock, db_session, make_arc):
    arc = make_arc()
    rule = {**_weekly([MON], interval=2), "anchor_on": "2020-01-01"}
    body = _create(client, arc.id, rule).json()
    # Set on Tuesday: anchored on (and first due) the next Monday, not 13 days out.
    assert body["due_on"] == "2026-11-02"
    stored = db_session.get(models.Quest, uuid.UUID(body["id"])).recurrence
    assert stored == {"frequency": "weekly", "interval": 2, "weekdays": [MON], "anchor_on": "2026-11-02"}


def test_create_weekly_weekdays_normalized(client, clock, make_arc):
    arc = make_arc()
    body = _create(client, arc.id, {"frequency": "weekly", "weekdays": [FRI, MON, FRI]}).json()
    assert body["recurrence"] == {"frequency": "weekly", "interval": 1, "weekdays": [MON, FRI]}


INVALID_RULES = [
    pytest.param({"frequency": "weekly", "weekdays": []}, id="weekdays-empty"),
    pytest.param({"frequency": "weekly"}, id="weekdays-missing"),
    pytest.param({"frequency": "weekly", "weekdays": [7]}, id="weekday-too-high"),
    pytest.param({"frequency": "weekly", "weekdays": [-1]}, id="weekday-negative"),
    pytest.param({"frequency": "weekly", "interval": 0, "weekdays": [MON]}, id="interval-0"),
    pytest.param({"frequency": "weekly", "interval": 53, "weekdays": [MON]}, id="interval-53"),
    pytest.param({"frequency": "monthly"}, id="unknown-frequency"),
    pytest.param({"interval": 1}, id="frequency-missing"),
]


@pytest.mark.parametrize("rule", INVALID_RULES)
def test_create_with_invalid_rule_400(client, make_arc, rule):
    arc = make_arc()
    assert_error_response(_create(client, arc.id, rule), 400, "validation_error")


@pytest.mark.parametrize("offset", [900, -900])
def test_create_with_out_of_range_offset_400(client, make_arc, offset):
    arc = make_arc()
    assert_error_response(_create(client, arc.id, DAILY, utc_offset_minutes=offset), 400, "validation_error")


def test_create_uses_utc_offset_for_first_occurrence(client, make_arc, monkeypatch):
    # Real local_today, frozen clock: 23:30 UTC on a Thursday is already Friday at +60.
    frozen_now = datetime(2026, 10, 29, 23, 30, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now

    monkeypatch.setattr(recurrence, "datetime", _FrozenDatetime)
    arc = make_arc()
    assert _create(client, arc.id, _weekly([FRI])).json()["due_on"] == "2026-10-30"
    assert _create(client, arc.id, _weekly([THU])).json()["due_on"] == "2026-10-29"
    assert _create(client, arc.id, _weekly([THU]), utc_offset_minutes=60).json()["due_on"] == "2026-11-05"


# --- completion -------------------------------------------------------------------------


def test_complete_daily_spawns_next_instance_tomorrow(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()

    resp = client.post(f"/quests/{created['id']}/complete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed"] is True
    assert body["completed_on"] == "2026-10-27"
    # The completed instance keeps its own due day and series as history.
    assert body["due_on"] == "2026-10-27"
    assert body["series_id"] == created["series_id"]
    # The new open instance means the arc is not fully completed.
    assert body["arc_fully_completed"] is False

    nxt = body["next_instance"]
    assert nxt["id"] != created["id"]
    assert nxt["due_on"] == "2026-10-28"
    assert nxt["completed"] is False
    assert nxt["completed_on"] is None
    assert nxt["series_id"] == created["series_id"]
    assert nxt["recurrence"] == DAILY
    assert nxt["title"] == "Water plants"
    assert nxt["description"] == "All of them"
    assert nxt["arc_id"] == str(arc.id)
    assert "next_instance" not in nxt

    # Exactly one open instance in the series: the one just spawned.
    assert [str(q.id) for q in _open_in_series(db_session, created["series_id"])] == [nxt["id"]]

    listing = _active_arc(client, arc.id)
    assert listing["quests"] == []
    assert _ids(listing["upcoming"]) == [nxt["id"]]
    assert _ids(listing["recent_completed"]) == [created["id"]]


def test_every_2_weeks_mon_set_on_tuesday_due_next_monday_then_2_weeks_later(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([MON], interval=2)).json()
    assert created["due_on"] == "2026-11-02"
    clock.today = date(2026, 11, 2)
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    assert nxt["due_on"] == "2026-11-16"


def test_every_4_weeks_wed_set_on_thursday_due_next_wednesday(client, clock, make_arc, make_quest):
    clock.today = date(2026, 10, 29)
    arc = make_arc()
    quest = make_quest(arc.id)
    body = client.put(f"/quests/{quest.id}/recurrence", json={"recurrence": _weekly([WED], interval=4)}).json()
    assert body["due_on"] == "2026-11-04"


def test_complete_copies_stored_rule_without_reanchoring(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([TUE], interval=2)).json()
    clock.today = date(2026, 11, 3)
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    # Anchored on 2026-10-27's week: the next "on" Tuesday is two weeks after it, not two
    # weeks after the completion day.
    assert nxt["due_on"] == "2026-11-10"
    stored = db_session.get(models.Quest, uuid.UUID(nxt["id"])).recurrence
    assert stored["anchor_on"] == "2026-10-27"


def test_complete_early_skips_past_current_due_day(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([FRI])).json()
    assert created["due_on"] == "2026-10-30"
    # Completed from Upcoming on Tuesday: the next one is the Friday after the current due day.
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    assert nxt["due_on"] == "2026-11-06"


def test_overdue_instance_stays_listed_and_completion_skips_missed_days(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()

    clock.today = date(2026, 10, 30)
    # Overdue (due before today) instances stay in the arc's quests.
    assert _ids(_active_arc(client, arc.id)["quests"]) == [created["id"]]

    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    assert nxt["due_on"] == "2026-10-31"


def test_overdue_weekly_completion_goes_to_next_matching_day_after_today(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([MON])).json()
    assert created["due_on"] == "2026-11-02"
    # Done late on Wednesday: next Monday, not the missed one.
    clock.today = date(2026, 11, 4)
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    assert nxt["due_on"] == "2026-11-09"


def test_recompleting_completed_instance_spawns_nothing(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    first = client.post(f"/quests/{created['id']}/complete").json()
    second = client.post(f"/quests/{created['id']}/complete").json()
    assert second["next_instance"] is None
    assert [str(q.id) for q in _open_in_series(db_session, created["series_id"])] == [first["next_instance"]["id"]]


def test_complete_plain_quest_has_no_next_instance(client, clock, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    body = client.post(f"/quests/{quest.id}/complete").json()
    assert body["next_instance"] is None
    assert body["arc_fully_completed"] is True


def test_upcoming_instance_blocks_sealing(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    body = client.post(f"/quests/{created['id']}/complete").json()
    assert body["arc_fully_completed"] is False
    # The only open quest is hidden in upcoming, but it is still open.
    assert _active_arc(client, arc.id)["quests"] == []
    assert_error_response(
        client.post(f"/arcs/{arc.id}/seal"),
        400,
        "validation_error",
        "Arc must have at least one quest and no open quests to be sealed",
    )


def test_complete_conflict_when_series_gains_open_instance_concurrently(
    client, clock, db_session, make_arc, monkeypatch
):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    original_commit = db_session.commit

    def fake_commit():
        # Simulates a racing request having already spawned the series' next instance.
        db_session.execute(
            insert(models.Quest).values(
                id=uuid.uuid4(),
                arc_id=arc.id,
                title="Racer",
                description="",
                completed=False,
                series_id=uuid.UUID(created["series_id"]),
            )
        )
        original_commit()

    monkeypatch.setattr(db_session, "commit", fake_commit)
    resp = client.post(f"/quests/{created['id']}/complete")
    assert_error_response(resp, 409, "conflict", "Quest was changed concurrently; reload and try again.")


# --- un-completion ----------------------------------------------------------------------


def test_uncomplete_deletes_spawned_instance_and_reports_it(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]

    resp = client.post(f"/quests/{created['id']}/uncomplete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["removed_instance_id"] == nxt["id"]
    assert body["completed"] is False
    assert body["completed_on"] is None
    assert body["due_on"] == "2026-10-27"
    assert body["series_id"] == created["series_id"]

    assert db_session.get(models.Quest, uuid.UUID(nxt["id"])) is None
    assert [str(q.id) for q in _open_in_series(db_session, created["series_id"])] == [created["id"]]
    listing = _active_arc(client, arc.id)
    assert _ids(listing["quests"]) == [created["id"]]
    assert listing["upcoming"] == []


def test_uncomplete_then_complete_again_respawns(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    client.post(f"/quests/{created['id']}/complete")
    client.post(f"/quests/{created['id']}/uncomplete")
    body = client.post(f"/quests/{created['id']}/complete").json()
    assert body["next_instance"]["due_on"] == "2026-10-28"
    assert len(_open_in_series(db_session, created["series_id"])) == 1


def test_uncomplete_open_series_instance_removes_nothing(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    body = client.post(f"/quests/{created['id']}/uncomplete").json()
    assert body["removed_instance_id"] is None
    assert [str(q.id) for q in _open_in_series(db_session, created["series_id"])] == [created["id"]]


def _assert_plain(body: dict) -> None:
    assert body["completed"] is False
    assert body["completed_on"] is None
    assert body["recurrence"] is None
    assert body["series_id"] is None
    assert body["due_on"] is None
    assert body["removed_instance_id"] is None


def test_uncomplete_older_instance_reopens_plain_and_keeps_open_instance(client, clock, db_session, make_arc):
    arc = make_arc()
    first = _create(client, arc.id, DAILY).json()
    second = client.post(f"/quests/{first['id']}/complete").json()["next_instance"]
    clock.today = date(2026, 10, 28)
    third = client.post(f"/quests/{second['id']}/complete").json()["next_instance"]

    body = client.post(f"/quests/{first['id']}/uncomplete").json()
    _assert_plain(body)
    # The live open instance (and the newer completed one) are untouched.
    assert [str(q.id) for q in _open_in_series(db_session, first["series_id"])] == [third["id"]]
    assert db_session.get(models.Quest, uuid.UUID(second["id"])).completed is True

    listing = _active_arc(client, arc.id)
    assert _ids(listing["quests"]) == [first["id"]]
    assert _ids(listing["upcoming"]) == [third["id"]]


def test_uncomplete_after_series_stopped_reopens_plain(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    client.delete(f"/quests/{nxt['id']}/recurrence")

    body = client.post(f"/quests/{created['id']}/uncomplete").json()
    _assert_plain(body)
    # The stopped quest survives as a plain quest and the old series does not come back.
    assert db_session.get(models.Quest, uuid.UUID(nxt["id"])).series_id is None
    assert _open_in_series(db_session, created["series_id"]) == []
    listing = _active_arc(client, arc.id)
    assert set(_ids(listing["quests"])) == {created["id"], nxt["id"]}
    assert listing["upcoming"] == []


def test_uncomplete_latest_after_open_instance_deleted_reopens_plain(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    client.delete(f"/quests/{nxt['id']}")

    body = client.post(f"/quests/{created['id']}/uncomplete").json()
    _assert_plain(body)
    assert _open_in_series(db_session, created["series_id"]) == []


def test_uncomplete_plain_quest_removes_nothing(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=True, completed_on=date(2026, 10, 1))
    body = client.post(f"/quests/{quest.id}/uncomplete").json()
    assert body["removed_instance_id"] is None
    assert body["completed"] is False


# --- PUT / DELETE /quests/{id}/recurrence -----------------------------------------------


def test_put_recurrence_turns_plain_quest_into_series(client, clock, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.put(f"/quests/{quest.id}/recurrence", json={"recurrence": _weekly([FRI])})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(quest.id)
    assert body["series_id"] is not None
    assert body["due_on"] == "2026-10-30"
    assert body["recurrence"] == _weekly([FRI])

    listing = _active_arc(client, arc.id)
    assert listing["quests"] == []
    assert _ids(listing["upcoming"]) == [str(quest.id)]


def test_put_recurrence_changes_rule_keeps_series_and_reanchors(client, clock, db_session, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([FRI])).json()
    clock.today = date(2026, 11, 3)
    body = client.put(f"/quests/{created['id']}/recurrence", json={"recurrence": _weekly([TUE], interval=3)}).json()
    assert body["series_id"] == created["series_id"]
    # First occurrence recomputed from the new today, today included.
    assert body["due_on"] == "2026-11-03"
    stored = db_session.get(models.Quest, uuid.UUID(created["id"])).recurrence
    assert stored["anchor_on"] == "2026-11-03"


def test_put_recurrence_skips_today_when_already_done(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    # Today (a Tuesday) is done, so "weekly on Tue" starts next week, not today.
    body = client.put(f"/quests/{nxt['id']}/recurrence", json={"recurrence": _weekly([TUE])}).json()
    assert body["due_on"] == "2026-11-03"
    assert body["series_id"] == created["series_id"]


def test_put_recurrence_adding_weekday_keeps_next_pending_one(client, clock, make_arc):
    clock.today = date(2026, 11, 2)
    arc = make_arc()
    created = _create(client, arc.id, _weekly([MON, WED])).json()
    assert created["due_on"] == "2026-11-02"
    wed = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    assert wed["due_on"] == "2026-11-04"
    # Still Monday: adding Friday must not pull Monday's done occurrence back in.
    body = client.put(f"/quests/{wed['id']}/recurrence", json={"recurrence": _weekly([MON, WED, FRI])}).json()
    assert body["due_on"] == "2026-11-04"


def test_put_recurrence_after_early_completion_schedules_past_its_due_day(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([WED])).json()
    assert created["due_on"] == "2026-10-28"
    # Wednesday's occurrence is done early, on Tuesday, so today and tomorrow are both covered.
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    body = client.put(f"/quests/{nxt['id']}/recurrence", json={"recurrence": DAILY}).json()
    assert body["due_on"] == "2026-10-29"


def test_put_recurrence_with_only_past_history_starts_today(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]
    clock.today = date(2026, 10, 30)
    body = client.put(f"/quests/{nxt['id']}/recurrence", json={"recurrence": _weekly([FRI])}).json()
    assert body["due_on"] == "2026-10-30"


def test_put_recurrence_on_completed_quest_400(client, clock, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=True, completed_on=date(2026, 10, 1))
    resp = client.put(f"/quests/{quest.id}/recurrence", json={"recurrence": DAILY})
    assert_error_response(resp, 400, "validation_error", "Recurrence can only be changed on an open quest")


def test_put_recurrence_unknown_field_400(client, clock, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.put(f"/quests/{quest.id}/recurrence", json={"recurrence": DAILY, "utc_offset": 60})
    assert_error_response(resp, 400, "validation_error")


def test_put_recurrence_missing_rule_400(client, clock, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    assert_error_response(client.put(f"/quests/{quest.id}/recurrence", json={}), 400, "validation_error")


@pytest.mark.parametrize("rule", INVALID_RULES)
def test_put_recurrence_invalid_rule_400(client, clock, make_arc, make_quest, rule):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.put(f"/quests/{quest.id}/recurrence", json={"recurrence": rule})
    assert_error_response(resp, 400, "validation_error")


def test_put_recurrence_nonexistent_quest_404(client, clock):
    resp = client.put(f"/quests/{uuid.uuid4()}/recurrence", json={"recurrence": DAILY})
    assert_error_response(resp, 404, "not_found")


def test_delete_recurrence_makes_plain_visible_quest(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, _weekly([FRI])).json()
    resp = client.delete(f"/quests/{created['id']}/recurrence")
    assert resp.status_code == 200
    body = resp.json()
    assert body["recurrence"] is None
    assert body["series_id"] is None
    assert body["due_on"] is None

    listing = _active_arc(client, arc.id)
    assert _ids(listing["quests"]) == [created["id"]]
    assert listing["upcoming"] == []

    # Completing it now spawns nothing.
    assert client.post(f"/quests/{created['id']}/complete").json()["next_instance"] is None


def test_delete_recurrence_is_idempotent_on_plain_quest(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.delete(f"/quests/{quest.id}/recurrence")
    assert resp.status_code == 200
    assert resp.json()["recurrence"] is None


def test_delete_recurrence_on_completed_quest_400(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=True, completed_on=date(2026, 10, 1))
    resp = client.delete(f"/quests/{quest.id}/recurrence")
    assert_error_response(resp, 400, "validation_error", "Recurrence can only be changed on an open quest")


def test_delete_recurrence_nonexistent_quest_404(client):
    assert_error_response(client.delete(f"/quests/{uuid.uuid4()}/recurrence"), 404, "not_found")


# --- views ------------------------------------------------------------------------------


def test_active_view_splits_quests_and_upcoming_by_utc_offset(client, make_arc, make_quest, monkeypatch):
    # Real local_today, frozen clock: 23:30 UTC on 2026-10-27 is already 2026-10-28 at +60.
    frozen_now = datetime(2026, 10, 27, 23, 30, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now

    monkeypatch.setattr(recurrence, "datetime", _FrozenDatetime)
    arc = make_arc()
    plain = make_quest(arc.id, title="Plain")
    due_today = make_quest(arc.id, title="Due today", due_on=date(2026, 10, 27), series_id=uuid.uuid4())
    due_tomorrow = make_quest(arc.id, title="Due tomorrow", due_on=date(2026, 10, 28), series_id=uuid.uuid4())

    listing = _active_arc(client, arc.id, utc_offset_minutes=0)
    assert set(_ids(listing["quests"])) == {str(plain.id), str(due_today.id)}
    assert _ids(listing["upcoming"]) == [str(due_tomorrow.id)]

    listing = _active_arc(client, arc.id, utc_offset_minutes=60)
    assert set(_ids(listing["quests"])) == {str(plain.id), str(due_today.id), str(due_tomorrow.id)}
    assert listing["upcoming"] == []


def test_upcoming_sorted_by_due_day_then_created_at(client, clock, make_arc, make_quest):
    base = datetime(2024, 1, 1, tzinfo=UTC)
    arc = make_arc()
    late = make_quest(arc.id, due_on=date(2026, 11, 5), series_id=uuid.uuid4(), created_at=base)
    soon_b = make_quest(arc.id, due_on=date(2026, 10, 30), series_id=uuid.uuid4(), created_at=base + timedelta(2))
    soon_a = make_quest(arc.id, due_on=date(2026, 10, 30), series_id=uuid.uuid4(), created_at=base + timedelta(1))
    listing = _active_arc(client, arc.id)
    assert _ids(listing["upcoming"]) == [str(soon_a.id), str(soon_b.id), str(late.id)]


def test_archive_view_lists_series_history_and_no_upcoming(client, clock, make_arc):
    arc = make_arc()
    created = _create(client, arc.id, DAILY).json()
    nxt = client.post(f"/quests/{created['id']}/complete").json()["next_instance"]

    listing = next(a for a in client.get("/arcs?view=archive").json() if a["id"] == str(arc.id))
    assert _ids(listing["quests"]) == [created["id"]]
    assert listing["quests"][0]["recurrence"] == DAILY
    assert listing["upcoming"] == []
    assert nxt["id"] not in _ids(listing["quests"])


# --- DB invariant -----------------------------------------------------------------------


def test_partial_unique_index_allows_one_open_instance_per_series(db_session, make_arc, make_quest):
    arc = make_arc()
    series_id = uuid.uuid4()
    # Any number of completed instances may share a series alongside one open instance.
    make_quest(arc.id, completed=True, completed_on=date(2026, 10, 1), series_id=series_id)
    make_quest(arc.id, completed=True, completed_on=date(2026, 10, 2), series_id=series_id)
    make_quest(arc.id, series_id=series_id)
    with pytest.raises(IntegrityError):
        make_quest(arc.id, series_id=series_id)
    db_session.rollback()
