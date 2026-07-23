class DomainError(Exception):
    """Base for all domain exceptions. Carries a human message and optional details."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(DomainError):
    def __init__(self, entity: str, entity_id: int | str) -> None:
        super().__init__(f"{entity} {entity_id} not found", details={"entity": entity, "id": str(entity_id)})


class ConflictError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class DomainValidationError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
