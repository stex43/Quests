from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.repositories import ArcRepository, QuestRepository

# Shared alias for brevity; FastAPI resolves get_db once per request, so handlers and both repos share one session.
DbSession = Annotated[Session, Depends(get_db)]


def get_arc_repo(db: DbSession) -> ArcRepository:
    return ArcRepository(db)


def get_quest_repo(db: DbSession) -> QuestRepository:
    return QuestRepository(db)


ArcRepo = Annotated[ArcRepository, Depends(get_arc_repo)]
QuestRepo = Annotated[QuestRepository, Depends(get_quest_repo)]
