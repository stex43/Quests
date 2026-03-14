import os

from pydantic_settings import BaseSettings, SettingsConfigDict


_app_env = os.getenv("APP_ENV")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=f".env.{_app_env}" if _app_env else ".env"
    )

    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    postgres_db: str
    cors_origins: list[str] = []
    debug: bool = False

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


# noinspection PyArgumentList
settings = Settings()
