import os
import re

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_app_env = os.getenv("APP_ENV")

# Hosts on this machine or the local network: localhost, loopback, the RFC 1918 private
# ranges and mDNS *.local names. Nothing routable on the public internet.
_LAN_HOST = (
    r"(?:localhost|\[::1\]|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}"
    r"|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}"
    r"|(?:[A-Za-z0-9-]+\.)*[A-Za-z0-9-]+\.local)"
)
_OPTIONAL_PORT = r"(?::\d{1,5})?"

# Browser origins (scheme://host[:port]) on a LAN host.
LAN_CORS_ORIGIN_REGEX = rf"^https?://{_LAN_HOST}{_OPTIONAL_PORT}$"
# Host header values (host[:port]) naming a LAN host.
LAN_HOST_REGEX = rf"^{_LAN_HOST}{_OPTIONAL_PORT}$"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=f".env.{_app_env}" if _app_env else ".env")

    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    postgres_db: str
    cors_origins: list[str] = []
    cors_origin_regex: str | None = LAN_CORS_ORIGIN_REGEX
    allowed_host_regex: str | None = LAN_HOST_REGEX
    debug: bool = False

    @field_validator("cors_origin_regex", "allowed_host_regex")
    @classmethod
    def validate_regex(cls, v: str | None, info: ValidationInfo) -> str | None:
        # An empty value turns regex matching off; anything else must compile.
        if not v:
            return None
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f"invalid {info.field_name.upper()}: {e}") from e
        return v

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


# noinspection PyArgumentList
settings = Settings()
