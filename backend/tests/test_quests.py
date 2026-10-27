import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete

from src import models
from tests.conftest import assert_error_response


def test_create_quest_empty_title_rejected(client, make_arc):
    arc = make_arc()
    resp = client.post(f"/arcs/{arc.id}/quests", json={"title": ""})
    assert resp.status_code == 400


def test_update_no_fields_provided_400(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.patch(f"/quests/{quest.id}", json={})
    assert_error_response(resp, 400, "validation_error", "At least one field must be provided for update")


def test_update_explicit_null_title_400(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.patch(f"/quests/{quest.id}", json={"title": None})
    assert_error_response(resp, 400, "validation_error", "title cannot be set to null")


def test_update_explicit_null_description_400(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.patch(f"/quests/{quest.id}", json={"description": None})
    assert_error_response(resp, 400, "validation_error", "description cannot be set to null")


def test_update_explicit_null_arc_id_400(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.patch(f"/quests/{quest.id}", json={"arc_id": None})
    assert_error_response(resp, 400, "validation_error", "arc_id cannot be set to null")


def test_update_move_to_nonexistent_arc_404(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.patch(f"/quests/{quest.id}", json={"arc_id": str(uuid.uuid4())})
    assert_error_response(resp, 404, "not_found")


def test_partial_update_leaves_other_fields_unchanged(client, db_session, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, title="Original Title", description="Original Description")
    resp = client.patch(f"/quests/{quest.id}", json={"description": "New Description"})
    assert resp.status_code == 204
    db_session.refresh(quest)
    assert quest.title == "Original Title"
    assert quest.description == "New Description"


def test_update_nonexistent_quest_404(client):
    resp = client.patch(f"/quests/{uuid.uuid4()}", json={"title": "New Title"})
    assert_error_response(resp, 404, "not_found")


def test_update_conflict_on_arc_move(client, db_session, make_arc, make_quest, monkeypatch):
    source_arc = make_arc()
    target_arc = make_arc()
    quest = make_quest(source_arc.id)

    original_commit = db_session.commit

    def fake_commit():
        db_session.execute(delete(models.Arc).where(models.Arc.id == target_arc.id))
        original_commit()

    monkeypatch.setattr(db_session, "commit", fake_commit)

    resp = client.patch(f"/quests/{quest.id}", json={"arc_id": str(target_arc.id)})
    assert_error_response(resp, 409, "conflict", "Update failed due to a conflict.")


def test_complete_quest_no_offset_uses_utc_day(client, make_arc, make_quest, monkeypatch):
    import src.repositories as repositories_module

    frozen_now = datetime(2026, 5, 10, 12, 0, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now

    monkeypatch.setattr(repositories_module, "datetime", _FrozenDatetime)

    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.post(f"/quests/{quest.id}/complete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed"] is True
    assert body["completed_on"] == "2026-05-10"


def test_complete_quest_with_offset_derives_local_day(client, make_arc, make_quest, monkeypatch):
    import src.repositories as repositories_module

    frozen_now = datetime(2026, 5, 10, 23, 30, tzinfo=UTC)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen_now

    monkeypatch.setattr(repositories_module, "datetime", _FrozenDatetime)

    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.post(f"/quests/{quest.id}/complete", json={"utc_offset_minutes": 60})
    assert resp.status_code == 200
    assert resp.json()["completed_on"] == "2026-05-11"


def test_complete_quest_idempotent_preserves_completed_on(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=True, completed_on=date(2020, 1, 1))
    resp = client.post(f"/quests/{quest.id}/complete", json={"utc_offset_minutes": 500})
    assert resp.status_code == 200
    assert resp.json()["completed_on"] == "2020-01-01"


def test_complete_quest_unknown_field_rejected(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.post(f"/quests/{quest.id}/complete", json={"bogus_field": 1})
    assert resp.status_code == 400
    assert resp.json()["error"] == "validation_error"


def test_complete_quest_arc_fully_completed_true(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.post(f"/quests/{quest.id}/complete")
    assert resp.status_code == 200
    assert resp.json()["arc_fully_completed"] is True


def test_complete_quest_arc_fully_completed_false(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    make_quest(arc.id, title="Still open")
    resp = client.post(f"/quests/{quest.id}/complete")
    assert resp.status_code == 200
    assert resp.json()["arc_fully_completed"] is False


def test_complete_nonexistent_quest_404(client):
    resp = client.post(f"/quests/{uuid.uuid4()}/complete")
    assert_error_response(resp, 404, "not_found")


def test_uncomplete_quest_clears_fields(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=True, completed_on=date(2024, 6, 1))
    resp = client.post(f"/quests/{quest.id}/uncomplete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed"] is False
    assert body["completed_on"] is None


def test_uncomplete_quest_idempotent(client, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id, completed=False)
    resp = client.post(f"/quests/{quest.id}/uncomplete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["completed"] is False
    assert body["completed_on"] is None


def test_uncomplete_nonexistent_quest_404(client):
    resp = client.post(f"/quests/{uuid.uuid4()}/uncomplete")
    assert_error_response(resp, 404, "not_found")


def test_delete_quest_success(client, db_session, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    resp = client.delete(f"/quests/{quest.id}")
    assert resp.status_code == 204
    assert db_session.get(models.Quest, quest.id) is None


def test_delete_nonexistent_quest_404(client):
    resp = client.delete(f"/quests/{uuid.uuid4()}")
    assert_error_response(resp, 404, "not_found")
