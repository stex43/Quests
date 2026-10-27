import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from sqlalchemy.exc import IntegrityError

from src import recurrence, response_building, schemas
from src.dependencies import ArcRepo, DbSession, QuestRepo
from src.exceptions import ConflictError, DomainValidationError, NotFoundError

router = APIRouter(prefix="/arcs", tags=["arcs"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=schemas.Arc)
def create_arc(arc: schemas.ArcCreate, db: DbSession, repo: ArcRepo):
    db_arc = repo.create(title=arc.title)
    db.commit()
    db.refresh(db_arc)
    return db_arc


# todo: paging
@router.get("", status_code=status.HTTP_200_OK, response_model=list[schemas.ArcExtended])
def get_arcs(
    repo: ArcRepo,
    view: Literal["active", "archive"] = "active",
    utc_offset_minutes: Annotated[int, Query(ge=-840, le=840)] | None = None,
):
    today = recurrence.local_today(utc_offset_minutes)
    responses = [response_building.build_arc_response(arc, view, today) for arc in repo.get_all()]
    if view == "archive":
        responses = [r for r in responses if r.quests]
    return responses


@router.put("/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_arc(arc_id: uuid.UUID, arc_update: schemas.ArcUpdate, db: DbSession, repo: ArcRepo):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise NotFoundError("Arc", arc_id)
    repo.update(db_arc, title=arc_update.title)
    db.commit()


@router.post("/{arc_id}/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(
    arc_id: uuid.UUID,
    quest: schemas.QuestCreate,
    db: DbSession,
    arc_repo: ArcRepo,
    quest_repo: QuestRepo,
):
    db_arc = arc_repo.get(arc_id)
    if not db_arc:
        raise NotFoundError("Arc", arc_id)
    if db_arc.sealed_at is not None:
        arc_repo.unseal(db_arc)
    db_quest = quest_repo.create(
        title=quest.title,
        description=quest.description,
        arc_id=arc_id,
        rule=quest.recurrence,
        today=recurrence.local_today(quest.utc_offset_minutes),
    )
    try:
        db.commit()
    except IntegrityError:
        # Roll back the failed transaction before raising; get_db's own rollback on exception is then a no-op.
        db.rollback()
        raise ConflictError("Target arc no longer exists.")
    db.refresh(db_quest)
    return db_quest


@router.delete("/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arc(arc_id: uuid.UUID, db: DbSession, repo: ArcRepo):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise NotFoundError("Arc", arc_id)
    repo.delete(db_arc)
    db.commit()


@router.post("/{arc_id}/seal", status_code=status.HTTP_200_OK, response_model=schemas.ArcSealState)
def seal_arc(arc_id: uuid.UUID, db: DbSession, arc_repo: ArcRepo, quest_repo: QuestRepo):
    db_arc = arc_repo.get(arc_id)
    if not db_arc:
        raise NotFoundError("Arc", arc_id)
    if quest_repo.count_total(arc_id) == 0 or quest_repo.count_open(arc_id) > 0:
        raise DomainValidationError("Arc must have at least one quest and no open quests to be sealed")
    arc_repo.seal(db_arc)
    db.commit()
    db.refresh(db_arc)
    return db_arc


@router.post("/{arc_id}/unseal", status_code=status.HTTP_200_OK, response_model=schemas.ArcSealState)
def unseal_arc(arc_id: uuid.UUID, db: DbSession, repo: ArcRepo):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise NotFoundError("Arc", arc_id)
    repo.unseal(db_arc)
    db.commit()
    db.refresh(db_arc)
    return db_arc
