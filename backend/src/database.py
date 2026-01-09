from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.settings import settings


# todo: wtf is engine and SessionLocal
engine = create_engine(settings.database_url, echo=True)
# todo: what is autocommit and autoflush and why false
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        # todo: what is yield in python
        yield db
    finally:
        db.close()

# todo: async?
