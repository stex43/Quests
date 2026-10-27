import pytest
from sqlalchemy.exc import InvalidRequestError

from src import models


def test_unloaded_arc_relationship_raises(db_session, make_arc, make_quest):
    arc = make_arc()
    quest = make_quest(arc.id)
    db_session.expire_all()
    fetched = db_session.get(models.Quest, quest.id)

    with pytest.raises(InvalidRequestError):
        _ = fetched.arc
