import re
from urllib.parse import urlsplit

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from src.schemas import ErrorResponse

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class LanRequestGuard:
    """Rejects requests addressed to a foreign Host (DNS rebinding) with 400, and unsafe
    requests from a disallowed Origin (cross-site writes) with 403.

    Pure ASGI so it adds no per-request task overhead. Its responses bypass the app's
    exception handlers, so it builds the ErrorResponse body itself.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        allowed_host_regex: str | None,
        cors_origins: list[str],
        cors_origin_regex: str | None,
    ) -> None:
        self.app = app
        self.allowed_host = re.compile(allowed_host_regex) if allowed_host_regex else None
        self.cors_origins = frozenset(cors_origins)
        self.cors_origin = re.compile(cors_origin_regex) if cors_origin_regex else None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers: dict[bytes, bytes] = {}
        for name, value in scope["headers"]:
            headers.setdefault(name, value)

        host = headers.get(b"host", b"").decode("latin-1")

        if self.allowed_host is not None:
            if not host or not self.allowed_host.fullmatch(host):
                await _reject(400, "invalid_host", "Host header is not allowed")(scope, receive, send)
                return

        origin_raw = headers.get(b"origin")
        if scope["method"] not in _SAFE_METHODS and origin_raw is not None:
            origin = origin_raw.decode("latin-1")
            if not self._origin_allowed(origin, scope["scheme"], host):
                await _reject(403, "forbidden_origin", "Origin is not allowed")(scope, receive, send)
                return

        await self.app(scope, receive, send)

    def _origin_allowed(self, origin: str, scheme: str, host: str) -> bool:
        if origin in self.cors_origins:
            return True
        if self.cors_origin is not None and self.cors_origin.fullmatch(origin) is not None:
            return True
        return self._is_same_origin(origin, scheme, host)

    @staticmethod
    def _is_same_origin(origin: str, scheme: str, host: str) -> bool:
        """Whether the Origin names this very server, so the page making the write was served
        by it (e.g. Swagger's "Try it out" on /docs). Safe to accept because the Host header it
        is compared against was already validated by the host check above.
        """
        parts = urlsplit(origin)
        # "Origin: null" and other opaque origins carry no host, so they never match.
        if not parts.netloc or not host:
            return False
        return parts.scheme.lower() == scheme.lower() and parts.netloc.lower() == host.lower()


def _reject(status_code: int, error: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(error=error, message=message, details=None).model_dump(),
    )
