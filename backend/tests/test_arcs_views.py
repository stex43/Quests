from datetime import UTC, date, datetime, timedelta

import pytest

_BASE_TIME = datetime(2024, 1, 1, tzinfo=UTC)


def _ticks(n: int) -> list[datetime]:
    # Distinct, strictly increasing created_at values. Needed because the whole test runs
    # inside one outer Postgres transaction, so server_default=func.now() would otherwise
    # resolve to the exact same instant for every row in the test.
    return [_BASE_TIME + timedelta(seconds=i) for i in range(n)]


def _arc(listing, arc_id):
    return next(a for a in listing if a["id"] == str(arc_id))


def test_active_view_shows_only_open_quests_oldest_first(client, make_arc, make_quest):
    t1, t2, t3 = _ticks(3)
    arc = make_arc()
    q1 = make_quest(arc.id, title="First", completed=False, created_at=t1)
    make_quest(arc.id, title="Second", completed=True, completed_on=date.today(), created_at=t2)
    q3 = make_quest(arc.id, title="Third", completed=False, created_at=t3)

    listing = client.get("/arcs?view=active").json()
    body = _arc(listing, arc.id)
    assert [q["id"] for q in body["quests"]] == [str(q1.id), str(q3.id)]


def test_active_view_recent_completed_only_today_newest_first_capped(client, make_arc, make_quest):
    arc = make_arc()
    today = datetime.now(UTC).date()
    yesterday = today - timedelta(days=1)

    ticks = _ticks(7)
    make_quest(arc.id, title="Old completion", completed=True, completed_on=yesterday, created_at=ticks[0])
    today_quests = [
        make_quest(arc.id, title=f"Today {i}", completed=True, completed_on=today, created_at=ticks[i + 1])
        for i in range(6)
    ]

    listing = client.get("/arcs?view=active").json()
    body = _arc(listing, arc.id)

    # completed_count reflects only today's completions, not all-time.
    assert body["completed_count"] == 6
    # Capped at 5, newest first.
    assert len(body["recent_completed"]) == 5
    expected_ids = [str(q.id) for q in reversed(today_quests)][:5]
    assert [q["id"] for q in body["recent_completed"]] == expected_ids


def test_archive_view_contains_all_completed_sorted_desc(client, make_arc, make_quest):
    arc = make_arc()
    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    make_quest(arc.id, title="Open", completed=False)
    q_old = make_quest(arc.id, title="Oldest", completed=True, completed_on=two_days_ago)
    q_mid = make_quest(arc.id, title="Middle", completed=True, completed_on=yesterday)
    q_new = make_quest(arc.id, title="Newest", completed=True, completed_on=today)

    listing = client.get("/arcs?view=archive").json()
    body = _arc(listing, arc.id)

    assert [q["id"] for q in body["quests"]] == [str(q_new.id), str(q_mid.id), str(q_old.id)]
    assert body["completed_count"] == 3
    assert body["recent_completed"] == []


def test_archive_view_omits_arcs_with_no_completed_quests(client, make_arc, make_quest):
    arc = make_arc()
    make_quest(arc.id, title="Open only", completed=False)

    listing = client.get("/arcs?view=archive").json()
    assert all(a["id"] != str(arc.id) for a in listing)


def test_utc_offset_shifts_today_boundary_near_utc_midnight(client, make_arc, make_quest, monkeypatch):
    import src.recurrence as recurrence_module

    # Freeze "now" to just before UTC midnight so offset 0 sees the quest as "yesterday"
    # but a positive offset shifts the local day forward into "today".
    frozen_now = datetime(2026, 1, 2, 23, 50, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now if tz is not None else frozen_now.replace(tzinfo=None)

    monkeypatch.setattr(recurrence_module, "datetime", _FrozenDatetime)

    arc = make_arc()
    # Quest completed "today" from the completer's perspective at the frozen instant with a
    # +60 minute offset: 2026-01-02 23:50 UTC + 60min = 2026-01-03 00:50 -> local day 2026-01-03.
    make_quest(arc.id, completed=True, completed_on=date(2026, 1, 3))

    # offset 0: viewer's "today" is 2026-01-02, so the quest (completed_on 2026-01-03) doesn't count.
    listing = client.get("/arcs?view=active&utc_offset_minutes=0").json()
    body = _arc(listing, arc.id)
    assert body["completed_count"] == 0

    # offset +60: viewer's "today" is 2026-01-03, matching the quest's completed_on.
    listing = client.get("/arcs?view=active&utc_offset_minutes=60").json()
    body = _arc(listing, arc.id)
    assert body["completed_count"] == 1


@pytest.mark.parametrize("offset", [900, -900])
def test_utc_offset_out_of_range_is_validation_error(client, offset):
    resp = client.get(f"/arcs?utc_offset_minutes={offset}")
    assert resp.status_code == 400
    assert resp.json()["error"] == "validation_error"


def test_arc_list_ordering_newest_first(client, make_arc):
    t1, t2, t3 = _ticks(3)
    first = make_arc(title="First", created_at=t1)
    second = make_arc(title="Second", created_at=t2)
    third = make_arc(title="Third", created_at=t3)

    listing = client.get("/arcs").json()
    ids = [a["id"] for a in listing if a["id"] in {str(first.id), str(second.id), str(third.id)}]
    assert ids == [str(third.id), str(second.id), str(first.id)]
