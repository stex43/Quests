import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete

from src import models
from tests.conftest import assert_error_response


def test_create_arc_success(client):
    resp = client.post("/arcs", json={"title": "New Arc"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "New Arc"
    assert "id" in body


def test_create_arc_empty_title_rejected(client):
    resp = client.post("/arcs", json={"title": ""})
    assert resp.status_code == 400


def test_update_arc_success(client, db_session, make_arc):
    arc = make_arc(title="Old Title")
    resp = client.put(f"/arcs/{arc.id}", json={"title": "Updated Title"})
    assert resp.status_code == 204

    db_session.refresh(arc)
    assert arc.title == "Updated Title"


def test_update_nonexistent_arc_404(client):
    resp = client.put(f"/arcs/{uuid.uuid4()}", json={"title": "Doesn't matter"})
    assert_error_response(resp, 404, "not_found")


def test_delete_arc_success_cascades_quests(client, db_session, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)

    resp = client.delete(f"/arcs/{arc.id}")
    assert resp.status_code == 204

    assert db_session.get(models.Arc, arc.id) is None
    assert db_session.get(models.Quest, quest.id) is None


def test_delete_nonexistent_arc_404(client):
    resp = client.delete(f"/arcs/{uuid.uuid4()}")
    assert_error_response(resp, 404, "not_found")


def test_seal_fails_with_zero_quests(client, make_arc):
    arc = make_arc()
    resp = client.post(f"/arcs/{arc.id}/seal")
    assert_error_response(
        resp, 400, "validation_error", "Arc must have at least one quest and no open quests to be sealed"
    )


def test_seal_fails_with_open_quest(client, make_arc, make_quest):
    arc = make_arc()
    make_quest(arc.id, completed=False)
    resp = client.post(f"/arcs/{arc.id}/seal")
    assert_error_response(
        resp, 400, "validation_error", "Arc must have at least one quest and no open quests to be sealed"
    )


def test_seal_succeeds_when_all_quests_completed(client, make_arc, make_quest):
    arc = make_arc()
    make_quest(arc.id, completed=True, completed_on=date.today())
    resp = client.post(f"/arcs/{arc.id}/seal")
    assert resp.status_code == 200
    body = resp.json()
    assert body["sealed_at"] is not None


def test_unseal_is_idempotent(client, make_arc):
    arc = make_arc()
    resp = client.post(f"/arcs/{arc.id}/unseal")
    assert resp.status_code == 200
    assert resp.json()["sealed_at"] is None

    # Calling again on an already-unsealed arc is still a success.
    resp = client.post(f"/arcs/{arc.id}/unseal")
    assert resp.status_code == 200
    assert resp.json()["sealed_at"] is None


def test_create_quest_success(client, make_arc):
    arc = make_arc()
    resp = client.post(f"/arcs/{arc.id}/quests", json={"title": "New Quest", "description": "Some details"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "New Quest"
    assert body["description"] == "Some details"
    assert body["arc_id"] == str(arc.id)


def test_create_quest_under_nonexistent_arc_404(client):
    arc_id = uuid.uuid4()
    resp = client.post(f"/arcs/{arc_id}/quests", json={"title": "New Quest"})
    assert_error_response(resp, 404, "not_found")


def test_creating_quest_under_sealed_arc_auto_unseals(client, db_session, make_arc):
    arc = make_arc(sealed_at=datetime.now(UTC))
    resp = client.post(f"/arcs/{arc.id}/quests", json={"title": "New Quest"})
    assert resp.status_code == 201

    db_session.refresh(arc)
    assert arc.sealed_at is None


def test_uncompleting_quest_auto_unseals_arc(client, db_session, make_arc, make_quest):
    arc = make_arc(sealed_at=datetime.now(UTC))
    quest = make_quest(arc.id, completed=True, completed_on=date.today())

    resp = client.post(f"/quests/{quest.id}/uncomplete")
    assert resp.status_code == 200

    db_session.refresh(arc)
    assert arc.sealed_at is None


def test_create_quest_conflict_when_arc_deleted_concurrently(client, db_session, make_arc, monkeypatch):
    arc = make_arc()
    original_commit = db_session.commit

    def fake_commit():
        db_session.execute(delete(models.Arc).where(models.Arc.id == arc.id))
        original_commit()

    monkeypatch.setattr(db_session, "commit", fake_commit)

    resp = client.post(f"/arcs/{arc.id}/quests", json={"title": "Doomed Quest"})
    assert_error_response(resp, 409, "conflict", "Target arc no longer exists.")
