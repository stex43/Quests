import uuid


class DomainError(Exception):
    """Base for all domain exceptions. Carries a human message and optional details."""

    status_code = 400
    error = "domain_error"

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(DomainError):
    status_code = 404
    error = "not_found"

    def __init__(self, entity: str, entity_id: uuid.UUID | int | str) -> None:
        super().__init__(f"{entity} {entity_id} not found", details={"entity": entity, "id": str(entity_id)})


class ConflictError(DomainError):
    status_code = 409
    error = "conflict"

    def __init__(self, message: str) -> None:
        super().__init__(message)


class DomainValidationError(DomainError):
    error = "validation_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
