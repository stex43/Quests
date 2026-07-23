import logging

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.exceptions import ConflictError, DomainError, DomainValidationError, NotFoundError
from src.schemas import ErrorResponse

logger = logging.getLogger("quests")


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(error="domain_error", message=exc.message, details=exc.details).model_dump(),
    )


async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(error="not_found", message=exc.message, details=exc.details).model_dump(),
    )


async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content=ErrorResponse(error="conflict", message=exc.message, details=exc.details).model_dump(),
    )


async def validation_error_handler(request: Request, exc: DomainValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(error="validation_error", message=exc.message, details=exc.details).model_dump(),
    )


async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error="validation_error",
            message="Request validation failed",
            details={"errors": jsonable_encoder(exc.errors())},
        ).model_dump(),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception during request to %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="internal_error", message="An internal error occurred", details=None).model_dump(),
    )
