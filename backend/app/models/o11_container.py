from datetime import datetime
from typing import Any, Optional
from sqlalchemy import ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class O11Container(Base):
    __tablename__ = "o11_containers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    network_mode: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    environment: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True, default=dict
    )
    ports: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON, nullable=True, default=dict
    )
    volumes: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True, default=list
    )
    restart_policy: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default="unless-stopped"
    )
    command: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    container_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created")
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = mapped_column(server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        onupdate=func.now(), nullable=True
    )
