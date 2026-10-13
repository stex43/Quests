from datetime import date

from src import models, schemas

PREVIEW_CAP = 5


def build_arc_response(arc: models.Arc, view: str, today: date) -> schemas.ArcExtended:
    completed = [q for q in arc.quests if q.completed]
    completed_desc = sorted(completed, key=lambda q: (q.completed_on or date.min, q.created_at), reverse=True)
    if view == "archive":
        return schemas.ArcExtended(
            id=arc.id,
            title=arc.title,
            sealed_at=arc.sealed_at,
            quests=completed_desc,
            recent_completed=[],
            completed_count=len(completed_desc),
        )
    quests = [q for q in arc.quests if not q.completed]
    today_completed = [q for q in completed_desc if q.completed_on == today]
    return schemas.ArcExtended(
        id=arc.id,
        title=arc.title,
        sealed_at=arc.sealed_at,
        quests=quests,
        recent_completed=today_completed[:PREVIEW_CAP],
        completed_count=len(today_completed),
    )
