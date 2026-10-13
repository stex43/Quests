from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.exceptions import DomainError
from src.schemas import ErrorResponse


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(error=exc.error, message=exc.message, details=exc.details).model_dump(),
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
