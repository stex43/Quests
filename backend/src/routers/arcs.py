import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from src import schemas
from src.dependencies import ArcRepo, DbSession, QuestRepo

router = APIRouter(prefix="/arcs", tags=["arcs"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=schemas.Arc)
def create_arc(arc: schemas.ArcCreate, db: DbSession, repo: ArcRepo):
    db_arc = repo.create(title=arc.title)
    db.commit()
    db.refresh(db_arc)
    return db_arc


# todo: paging
@router.get("", status_code=status.HTTP_200_OK, response_model=list[schemas.ArcExtended])
def get_arcs(repo: ArcRepo):
    return repo.get_all()


@router.put("/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_arc(arc_id: uuid.UUID, arc_update: schemas.ArcUpdate, db: DbSession, repo: ArcRepo):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.update(db_arc, title=arc_update.title)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Update failed due to a conflict.")


@router.post("/{arc_id}/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(
    arc_id: uuid.UUID,
    quest: schemas.QuestCreate,
    db: DbSession,
    arc_repo: ArcRepo,
    quest_repo: QuestRepo,
):
    if not arc_repo.get(arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    db_quest = quest_repo.create(title=quest.title, description=quest.description, arc_id=arc_id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Target arc no longer exists.")
    db.refresh(db_quest)
    return db_quest


@router.get("/{arc_id}/quests", status_code=status.HTTP_200_OK, response_model=list[schemas.Quest])
def get_quests_by_arc(
    arc_id: uuid.UUID,
    arc_repo: ArcRepo,
    quest_repo: QuestRepo,
):
    if not arc_repo.get(arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    return quest_repo.get_by_arc(arc_id)


@router.delete("/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arc(arc_id: uuid.UUID, db: DbSession, repo: ArcRepo):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.delete(db_arc)
    db.commit()
