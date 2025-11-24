import uuid

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Quest(BaseModel):
    id: uuid.UUID
    name: str
    description: str


class Saga(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    quests: list[Quest] = []


@app.get("/")
def read_root():
    return {"Hello": "World"}


# @src.get("/items/{item_id}")
# def read_item(item_id: int, q: Union[str, None] = None):
#     return {"item_id": item_id, "q": q}
#
#
# @src.put("/items/{item_id}")
# def update_item(item_id: int, item: Item):
#     return {"item_name": item.name, "item_id": item_id}
