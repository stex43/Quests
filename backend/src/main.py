import uuid

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.params import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src import models, schemas
from src.database import engine, get_db
from src.settings import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/arcs", status_code=status.HTTP_201_CREATED, response_model=schemas.Arc)
def create_arc(arc: schemas.ArcCreate, db_session: Session = Depends(get_db)):
    new_arc = models.Arc(id=uuid.uuid4(), title=arc.title)
    db_session.add(new_arc)
    db_session.commit()
    return new_arc


# todo: paging
@app.get("/arcs", status_code=status.HTTP_200_OK, response_model=list[schemas.ArcExtended])
def get_arcs(db_session: Session = Depends(get_db)):
    return db_session.scalars(select(models.Arc)).all()


@app.post("/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(quest: schemas.QuestCreate, db_session: Session = Depends(get_db)):
    new_quest = models.Quest(id=uuid.uuid4(), title=quest.title, description=quest.description, arc_id=quest.arc_id)
    db_session.add(new_quest)
    db_session.commit()
    return new_quest
