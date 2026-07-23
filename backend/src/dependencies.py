from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.repositories import ArcRepository, QuestRepository

# DbSession is a shared Annotated alias. Both get_arc_repo and get_quest_repo use it,
# so FastAPI resolves get_db once per request and both repos share the same session.
# Do NOT inline Annotated[Session, Depends(get_db)] separately in each factory —
# that would create two independent sessions within the same request.
DbSession = Annotated[Session, Depends(get_db)]


def get_arc_repo(db: DbSession) -> ArcRepository:
    return ArcRepository(db)


def get_quest_repo(db: DbSession) -> QuestRepository:
    return QuestRepository(db)


ArcRepo = Annotated[ArcRepository, Depends(get_arc_repo)]
QuestRepo = Annotated[QuestRepository, Depends(get_quest_repo)]
