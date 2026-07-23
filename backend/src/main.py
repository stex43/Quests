from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from src import exception_handlers
from src.exceptions import ConflictError, DomainError, DomainValidationError, NotFoundError
from src.routers import arcs, quests
from src.settings import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(DomainError, exception_handlers.domain_error_handler)
app.add_exception_handler(NotFoundError, exception_handlers.not_found_handler)
app.add_exception_handler(ConflictError, exception_handlers.conflict_handler)
app.add_exception_handler(DomainValidationError, exception_handlers.validation_error_handler)
app.add_exception_handler(RequestValidationError, exception_handlers.request_validation_handler)
app.add_exception_handler(Exception, exception_handlers.unhandled_exception_handler)


@app.get("/")
def read_root():
    return {"Hello": "World"}


app.include_router(arcs.router)
app.include_router(quests.router)
