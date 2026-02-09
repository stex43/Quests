import uuid

from fastapi import FastAPI, status
from fastapi.params import Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src import models
from src.database import engine, get_db

app = FastAPI()


class QuestCreate(BaseModel):
    title: str
    description: str
    arc_id: uuid.UUID


class Quest(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    arc_id: uuid.UUID


class ArcCreate(BaseModel):
    # todo: max length
    title: str
    # todo: max length
    description: str


class Arc(BaseModel):
    id: uuid.UUID
    title: str
    description: str


class ArcExtended(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    quests: list[Quest] = []


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/arcs", status_code=status.HTTP_201_CREATED, response_model=Arc)
def create_arc(arc: ArcCreate, db_session: Session = Depends(get_db)):
    new_arc = models.Arc(id=uuid.uuid4(), title=arc.title, description=arc.description)
    db_session.add(new_arc)
    db_session.commit()
    return new_arc


# todo: paging
@app.get("/arcs", status_code=status.HTTP_200_OK, response_model=list[ArcExtended])
def get_arcs(db_session: Session = Depends(get_db)):
    return db_session.scalars(select(models.Arc)).all()


@app.post("/quests", status_code=status.HTTP_201_CREATED, response_model=Quest)
def create_quest(quest: QuestCreate, db_session: Session = Depends(get_db)):
    new_quest = models.Quest(id=uuid.uuid4(), title=quest.title, description=quest.description, arc_id=quest.arc_id)
    db_session.add(new_quest)
    db_session.commit()
    return new_quest


# todo: paging
@app.get("/quests", status_code=status.HTTP_200_OK, response_model=list[Quest])
def get_quests(db_session: Session = Depends(get_db)):
    return db_session.scalars(select(models.Quest)).all()
