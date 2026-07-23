import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from src import schemas
from src.dependencies import ArcRepo, DbSession, QuestRepo

router = APIRouter(prefix="/quests", tags=["quests"])


@router.get("/{quest_id}", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def get_quest(quest_id: uuid.UUID, repo: QuestRepo):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
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
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    provided = quest_update.model_fields_set
    if not provided:
        raise HTTPException(status_code=400, detail="At least one field must be provided for update")
    if "title" in provided and quest_update.title is None:
        raise HTTPException(status_code=400, detail="title cannot be set to null")
    if "description" in provided and quest_update.description is None:
        raise HTTPException(status_code=400, detail="description cannot be set to null")
    if "arc_id" in provided and quest_update.arc_id is None:
        raise HTTPException(status_code=400, detail="arc_id cannot be set to null")
    if quest_update.arc_id is not None and not arc_repo.get(quest_update.arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {quest_update.arc_id} not found")
    quest_repo.update(
        db_quest, title=quest_update.title, description=quest_update.description, arc_id=quest_update.arc_id
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Update failed due to a conflict.")


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepo):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    repo.delete(db_quest)
    db.commit()
