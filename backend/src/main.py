import uuid

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
def create_arc(arc: schemas.ArcCreate, repo: ArcRepository = Depends(get_arc_repo)):
    return repo.create(title=arc.title)


# todo: paging
@app.get("/arcs", status_code=status.HTTP_200_OK, response_model=list[schemas.ArcExtended])
def get_arcs(repo: ArcRepository = Depends(get_arc_repo)):
    return repo.get_all()


@app.put("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_arc(arc_id: uuid.UUID, arc_update: schemas.ArcUpdate, repo: ArcRepository = Depends(get_arc_repo)):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.update(db_arc, title=arc_update.title)


@app.post("/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(
    quest: schemas.QuestCreate,
    arc_repo: ArcRepository = Depends(get_arc_repo),
    quest_repo: QuestRepository = Depends(get_quest_repo),
):
    if not arc_repo.get(quest.arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {quest.arc_id} not found")
    return quest_repo.create(title=quest.title, description=quest.description, arc_id=quest.arc_id)


@app.put("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_quest(
    quest_id: uuid.UUID,
    quest_update: schemas.QuestUpdate,
    arc_repo: ArcRepository = Depends(get_arc_repo),
    quest_repo: QuestRepository = Depends(get_quest_repo),
):
    db_quest = quest_repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    if not arc_repo.get(quest_update.arc_id):
        raise HTTPException(status_code=404, detail=f"Arc {quest_update.arc_id} not found")
    quest_repo.update(
        db_quest, title=quest_update.title, description=quest_update.description, arc_id=quest_update.arc_id
    )


@app.delete("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arc(arc_id: uuid.UUID, repo: ArcRepository = Depends(get_arc_repo)):
    db_arc = repo.get(arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    repo.delete(db_arc)


@app.delete("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, repo: QuestRepository = Depends(get_quest_repo)):
    db_quest = repo.get(quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    repo.delete(db_quest)
