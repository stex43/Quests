from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# todo: get all of that from config
# POSTGRES_URL = f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOSTNAME}:{settings.DATABASE_PORT}/{settings.POSTGRES_DB}"
POSTGRES_URL = "postgresql+psycopg://quests:quests@db:5432/quests"

# todo: wtf is engine and SessionLocal
engine = create_engine(POSTGRES_URL, echo=True)
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
