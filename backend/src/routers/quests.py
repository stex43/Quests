import uuid

from fastapi import APIRouter, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src import recurrence, schemas
from src.dependencies import ArcRepo, DbSession, QuestRepo
from src.exceptions import ConflictError, DomainValidationError, NotFoundError

router = APIRouter(prefix="/quests", tags=["quests"])


def _commit_series_change(db: Session) -> None:
    # A concurrent complete/uncomplete of the same series can race this one into a second
    # open instance, which uq_quests_open_series rejects at commit.
    try:
        db.commit()
    except IntegrityError:
        # Roll back the failed transaction before raising; get_db's own rollback on exception is then a no-op.
        db.rollback()
        raise ConflictError("Quest was changed concurrently; reload and try again.")


@router.patch("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_quest(
    quest_id: uuid.UUID,
    quest_update: schemas.QuestUpdate,
    db: DbSession,
    arc_repo: ArcRepo,
    quest_repo: QuestRepo,
):
    db_quest = quest_repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    provided = quest_update.model_fields_set
    if not provided:
        raise DomainValidationError("At least one field must be provided for update")
    if "title" in provided and quest_update.title is None:
        raise DomainValidationError("title cannot be set to null")
    if "description" in provided and quest_update.description is None:
        raise DomainValidationError("description cannot be set to null")
    if "arc_id" in provided and quest_update.arc_id is None:
        raise DomainValidationError("arc_id cannot be set to null")
    if quest_update.arc_id is not None and not arc_repo.get(quest_update.arc_id):
        raise NotFoundError("Arc", quest_update.arc_id)
    quest_repo.update(
        db_quest,
        title=quest_update.title,
        description=quest_update.description,
        arc_id=quest_update.arc_id,
    )
    try:
        db.commit()
    except IntegrityError:
        # Roll back the failed transaction before raising; get_db's own rollback on exception is then a no-op.
        db.rollback()
        raise ConflictError("Update failed due to a conflict.")


@router.post("/{quest_id}/complete", status_code=status.HTTP_200_OK, response_model=schemas.QuestCompleteResponse)
def complete_quest(
    quest_id: uuid.UUID,
    db: DbSession,
    repo: QuestRepo,
    # Body is optional: a caller that sends nothing completes the quest with a NULL offset.
    completion: schemas.QuestComplete | None = None,
):
    # Idempotent by design: calling this on an already-completed quest leaves it unchanged
    # (original completed_on intact, no new instance) and still returns the current quest.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    next_instance = repo.complete(db_quest, utc_offset_minutes=completion.utc_offset_minutes if completion else None)
    _commit_series_change(db)
    db.refresh(db_quest)
    if next_instance is not None:
        db.refresh(next_instance)
    # A spawned next instance is open, so a repeating quest never fully completes its arc.
    arc_fully_completed = repo.count_open(db_quest.arc_id) == 0
    return schemas.QuestCompleteResponse(
        **schemas.Quest.model_validate(db_quest).model_dump(),
        arc_fully_completed=arc_fully_completed,
        next_instance=next_instance,
    )


@router.post("/{quest_id}/uncomplete", status_code=status.HTTP_200_OK, response_model=schemas.QuestUncompleteResponse)
def uncomplete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo, arc_repo: ArcRepo):
    # Idempotent by design: calling this on an already-incomplete quest is a no-op and
    # still returns the current quest.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    removed_instance_id = repo.uncomplete(db_quest)
    arc = arc_repo.get(db_quest.arc_id)
    if arc is not None and arc.sealed_at is not None:
        arc_repo.unseal(arc)
    _commit_series_change(db)
    db.refresh(db_quest)
    return schemas.QuestUncompleteResponse(
        **schemas.Quest.model_validate(db_quest).model_dump(), removed_instance_id=removed_instance_id
    )


@router.put("/{quest_id}/recurrence", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def set_quest_recurrence(
    quest_id: uuid.UUID, recurrence_update: schemas.QuestRecurrenceUpdate, db: DbSession, repo: QuestRepo
):
    # Sets or replaces the rule; the quest's due_on is recomputed from the caller's today, or
    # from the day after the series' completed history if that already covers today.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    if db_quest.completed:
        raise DomainValidationError("Recurrence can only be changed on an open quest")
    repo.set_recurrence(
        db_quest, recurrence_update.recurrence, today=recurrence.local_today(recurrence_update.utc_offset_minutes)
    )
    db.commit()
    db.refresh(db_quest)
    return db_quest


@router.delete("/{quest_id}/recurrence", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def clear_quest_recurrence(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo):
    # Idempotent: stopping a quest that does not repeat leaves it unchanged. Open quests only,
    # matching PUT: a completed instance is series history and is not edited.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    if db_quest.completed:
        raise DomainValidationError("Recurrence can only be changed on an open quest")
    repo.clear_recurrence(db_quest)
    db.commit()
    db.refresh(db_quest)
    return db_quest


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    repo.delete(db_quest)
    db.commit()
