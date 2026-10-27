import atexit
import os
import uuid
from collections.abc import Callable
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

# A single Postgres container serves the whole test session. This block runs as plain
# module-level code (not inside a fixture) because pytest always imports a directory's
# conftest.py before collecting test modules in it, and any test module that imports
# anything from src (even indirectly) needs POSTGRES_* env vars set before that first
# import — a fixture body only runs during the run phase, which is too late.
#
# driver="psycopg": the app and this project use psycopg3 (psycopg[binary] in
# requirements.txt); testcontainers defaults to psycopg2 for its own readiness check
# unless told otherwise.
_pg = PostgresContainer("postgres:16", username="quests", password="quests", dbname="quests", driver="psycopg")
try:
    _pg.start()
except Exception as exc:
    pytest.exit(
        f"Could not start the Postgres test container ({type(exc).__name__}: {exc}). "
        "The test suite needs Docker; make sure Docker is installed and running.",
        returncode=1,
    )
atexit.register(_pg.stop)

os.environ["POSTGRES_USER"] = _pg.username
os.environ["POSTGRES_PASSWORD"] = _pg.password
os.environ["POSTGRES_HOST"] = _pg.get_container_host_ip()
os.environ["POSTGRES_PORT"] = str(_pg.get_exposed_port(5432))
os.environ["POSTGRES_DB"] = _pg.dbname

from src import models  # noqa: E402
from src.database import engine, get_db  # noqa: E402
from src.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    # drop_all/create_all (not Alembic) so the test schema always matches models.py exactly,
    # independent of migration history. Testing the Alembic chain itself is out of scope here.
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    yield


@pytest.fixture
def db_session():
    # The SQLAlchemy "join a Session into an external transaction" pattern: a route
    # handler's db.commit() mid-test only releases a SAVEPOINT instead of ending the real
    # transaction, so every test gets a fully isolated, auto-rolled-back transaction
    # regardless of how many times the code under test calls commit().
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, autoflush=False, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    trans.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app, base_url="http://localhost") as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def make_arc(db_session) -> Callable[..., models.Arc]:
    # created_at defaults to the DB server_default (NOW()), which — because the whole test
    # runs inside one outer Postgres transaction (see db_session above) — resolves to the
    # same instant for every row created in the test. Tests that assert ordering by
    # created_at must pass an explicit, distinct value per row.
    def _make_arc(
        title: str = "Test Arc", sealed_at: datetime | None = None, created_at: datetime | None = None
    ) -> models.Arc:
        arc = models.Arc(title=title, sealed_at=sealed_at)
        if created_at is not None:
            arc.created_at = created_at
        db_session.add(arc)
        db_session.flush()
        db_session.refresh(arc)
        return arc

    return _make_arc


@pytest.fixture
def make_quest(db_session) -> Callable[..., models.Quest]:
    # See make_arc above re: created_at and the shared-transaction NOW() caveat.
    def _make_quest(
        arc_id: uuid.UUID,
        title: str = "Test Quest",
        description: str = "",
        completed: bool = False,
        completed_on: date | None = None,
        created_at: datetime | None = None,
        due_on: date | None = None,
        series_id: uuid.UUID | None = None,
        recurrence: dict | None = None,
    ) -> models.Quest:
        quest = models.Quest(
            arc_id=arc_id,
            title=title,
            description=description,
            completed=completed,
            completed_on=completed_on,
            due_on=due_on,
            series_id=series_id,
            recurrence=recurrence,
        )
        if created_at is not None:
            quest.created_at = created_at
        db_session.add(quest)
        db_session.flush()
        db_session.refresh(quest)
        return quest

    return _make_quest


def assert_error_response(resp, status_code: int, error: str, message: str | None = None) -> None:
    assert resp.status_code == status_code
    body = resp.json()
    assert body["error"] == error
    if message is not None:
        assert body["message"] == message
