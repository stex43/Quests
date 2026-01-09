import uuid

from fastapi import FastAPI
from fastapi.params import Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src import models
from src.database import engine, get_db

app = FastAPI()


class Quest(BaseModel):
    id: uuid.UUID
    title: str
    description: str


class Saga(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    quests: list[Quest] = []


@app.get("/")
def read_root():
    return {"Hello": "World"}


# todo: work on responses in api
@app.post("/items")
def create_quest(quest: Quest, db: Session = Depends(get_db)):
    new_quest = models.Quest(id=uuid.uuid4(), title=quest.title, description=quest.description)
    db.add(new_quest)
    db.commit()
    db.refresh(new_quest)
    return {"status": "success", "quest": new_quest}
