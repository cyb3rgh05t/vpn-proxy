import os
import secrets
from pydantic_settings import BaseSettings


def _get_or_create_secret(path: str = "./data/.secret_key") -> str:
    """Return a stable secret key persisted to disk so JWT tokens survive restarts."""
    if os.path.exists(path):
        return open(path).read().strip()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    key = secrets.token_urlsafe(64)
    with open(path, "w") as f:
        f.write(key)
    return key


class Settings(BaseSettings):
    SECRET_KEY: str = _get_or_create_secret()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str = "sqlite:///./data/vpnproxy.db"
    GLUETUN_IMAGE: str = "qmcgaw/gluetun:latest"
    DATA_DIR: str = "./data"
    HOST_DATA_DIR: str = ""  # Host-side path for DATA_DIR when running in Docker

    # O11 Monitoring Panel
    O11_URL: str = ""  # e.g. http://50.7.224.34:7000
    O11_USERNAME: str = ""
    O11_PASSWORD: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

os.makedirs(settings.DATA_DIR, exist_ok=True)
