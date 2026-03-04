import uuid

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.params import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src import models, schemas
from src.database import get_db
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


@app.put("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_arc(arc_id: uuid.UUID, arc_update: schemas.ArcUpdate, db_session: Session = Depends(get_db)):
    db_arc = db_session.get(models.Arc, arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    db_arc.title = arc_update.title
    db_session.commit()


@app.post("/quests", status_code=status.HTTP_201_CREATED, response_model=schemas.Quest)
def create_quest(quest: schemas.QuestCreate, db_session: Session = Depends(get_db)):
    # what if there's no such arc
    new_quest = models.Quest(id=uuid.uuid4(), title=quest.title, description=quest.description, arc_id=quest.arc_id)
    db_session.add(new_quest)
    db_session.commit()
    return new_quest


@app.put("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_quest(quest_id: uuid.UUID, quest_update: schemas.QuestUpdate, db_session: Session = Depends(get_db)):
    db_quest = db_session.get(models.Quest, quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    db_quest.title = quest_update.title
    db_quest.description = quest_update.description
    # todo: what if there's no such arc
    # db_quest.arc_id = quest_update.arc_id
    db_session.commit()


@app.delete("/arcs/{arc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arc(arc_id: uuid.UUID, db_session: Session = Depends(get_db)):
    db_arc = db_session.get(models.Arc, arc_id)
    if not db_arc:
        raise HTTPException(status_code=404, detail=f"Arc {arc_id} not found")
    db_session.delete(db_arc)
    db_session.commit()


@app.delete("/quests/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quest(quest_id: uuid.UUID, db_session: Session = Depends(get_db)):
    db_quest = db_session.get(models.Quest, quest_id)
    if not db_quest:
        raise HTTPException(status_code=404, detail=f"Quest {quest_id} not found")
    db_session.delete(db_quest)
    db_session.commit()
