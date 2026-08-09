import uuid

from fastapi import APIRouter, status
from sqlalchemy.exc import IntegrityError

from src import schemas
from src.dependencies import ArcRepo, DbSession, QuestRepo
from src.exceptions import ConflictError, DomainValidationError, NotFoundError

router = APIRouter(prefix="/quests", tags=["quests"])


@router.get("/{quest_id}", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def get_quest(quest_id: uuid.UUID, repo: QuestRepo):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    return db_quest


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


@router.post("/{quest_id}/complete", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def complete_quest(
    quest_id: uuid.UUID,
    db: DbSession,
    repo: QuestRepo,
    # Body is optional: a caller that sends nothing completes the quest with a NULL offset.
    completion: schemas.QuestComplete | None = None,
):
    # Idempotent by design: calling this on an already-completed quest leaves it unchanged
    # (original completed_on intact) and still returns the current quest.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    quest = repo.complete(db_quest, utc_offset_minutes=completion.utc_offset_minutes if completion else None)
    db.commit()
    db.refresh(quest)
    return quest


@router.post("/{quest_id}/uncomplete", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def uncomplete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo):
    # Idempotent by design: calling this on an already-incomplete quest is a no-op and
    # still returns the current quest.
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    quest = repo.uncomplete(db_quest)
    db.commit()
    db.refresh(quest)
    return quest


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise NotFoundError("Quest", quest_id)
    repo.delete(db_quest)
    db.commit()
