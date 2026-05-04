from datetime import datetime
from typing import Any, Optional
from sqlalchemy import JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AppTemplate(Base):
    """User-managed container template shown in App Catalogue and CreateO11Container."""

    __tablename__ = "app_templates"

    id: Mapped[str] = mapped_column(String(100), primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image: Mapped[str] = mapped_column(String(300))
    suggested_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    restart_policy: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default="unless-stopped"
    )
    env_vars: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    ports: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    volumes: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    devices: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    labels: Mapped[Optional[list[dict[str, str]]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    is_builtin: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        onupdate=func.now(), nullable=True
    )
