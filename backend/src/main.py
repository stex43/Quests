import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src import schemas
from src.database import get_db
from src.repositories import ArcRepository, QuestRepository
from src.settings import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": jsonable_encoder(exc.errors())})


# DbSession is a shared Annotated alias. Both get_arc_repo and get_quest_repo use it,
# so FastAPI resolves get_db once per request and both repos share the same session.
# Do NOT inline Annotated[Session, Depends(get_db)] separately in each factory —
# that would create two independent sessions within the same request.
DbSession = Annotated[Session, Depends(get_db)]


def get_arc_repo(db: DbSession) -> ArcRepository:
    return ArcRepository(db)


def get_quest_repo(db: DbSession) -> QuestRepository:
    return QuestRepository(db)


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/arcs", status_code=status.HTTP_201_CREATED, response_model=schemas.Arc)
def create_arc(arc: schemas.ArcCreate, db: DbSession, repo: ArcRepository = Depends(get_arc_repo)):
    db_arc = repo.create(title=arc.title)
    db.commit()
    db.refresh(db_arc)
    return db_arc


# todo: paging
@app.get("/arcs", status_code=status.HTTP_200_OK, response_model=list[schemas.ArcExtended])
def get_arcs(repo: ArcRepository = Depends(get_arc_repo)):
    return repo.get_all()


@app.put("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_arc(
    arc_id: uuid.UUID, arc_update: schemas.ArcUpdate, db: DbSession, repo: ArcRepository = Depends(get_arc_repo)
):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.update(db_arc, title=arc_update.title)
    db.commit()


@app.post("/arcs/{arc_id}/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(
    arc_id: uuid.UUID,
    quest: schemas.QuestCreate,
    db: DbSession,
    arc_repo: ArcRepository = Depends(get_arc_repo),
    quest_repo: QuestRepository = Depends(get_quest_repo),
):
    if not arc_repo.get(arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    db_quest = quest_repo.create(title=quest.title, description=quest.description, arc_id=arc_id)
    db.commit()
    db.refresh(db_quest)
    return db_quest


@app.get("/arcs/{arc_id}/quests", status_code=status.HTTP_200_OK, response_model=list[schemas.Quest])
def get_quests_by_arc(
    arc_id: uuid.UUID,
    arc_repo: ArcRepository = Depends(get_arc_repo),
    quest_repo: QuestRepository = Depends(get_quest_repo),
):
    if not arc_repo.get(arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    return quest_repo.get_by_arc(arc_id)


@app.get("/quests/{quest_id}", status_code=status.HTTP_200_OK, response_model=schemas.Quest)
def get_quest(quest_id: uuid.UUID, repo: QuestRepository = Depends(get_quest_repo)):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    return db_quest


@app.patch("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_quest(
    quest_id: uuid.UUID,
    quest_update: schemas.QuestUpdate,
    db: DbSession,
    arc_repo: ArcRepository = Depends(get_arc_repo),
    quest_repo: QuestRepository = Depends(get_quest_repo),
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


@app.delete("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arc(arc_id: uuid.UUID, db: DbSession, repo: ArcRepository = Depends(get_arc_repo)):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.delete(db_arc)
    db.commit()


@app.delete("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, db: DbSession, repo: QuestRepository = Depends(get_quest_repo)):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    repo.delete(db_quest)
    db.commit()
