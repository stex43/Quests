import pytest
from pydantic import ValidationError

from src.settings import Settings

_REQUIRED_KWARGS = {
    "postgres_user": "user",
    "postgres_password": "password",
    "postgres_host": "localhost",
    "postgres_port": 5432,
    "postgres_db": "db",
}


def test_invalid_allowed_host_regex_raises():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **_REQUIRED_KWARGS, allowed_host_regex="(unclosed")


def test_invalid_cors_origin_regex_raises():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **_REQUIRED_KWARGS, cors_origin_regex="(unclosed")


def test_empty_allowed_host_regex_coerced_to_none():
    settings = Settings(_env_file=None, **_REQUIRED_KWARGS, allowed_host_regex="")
    assert settings.allowed_host_regex is None


def test_empty_cors_origin_regex_coerced_to_none():
    settings = Settings(_env_file=None, **_REQUIRED_KWARGS, cors_origin_regex="")
    assert settings.cors_origin_regex is None
