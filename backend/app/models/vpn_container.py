from datetime import datetime
from typing import Any, Optional
from sqlalchemy import ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class VPNContainer(Base):
    __tablename__ = "vpn_containers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    vpn_provider: Mapped[str] = mapped_column(String(100))
    vpn_type: Mapped[str] = mapped_column(String(50), default="openvpn")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    port_http_proxy: Mapped[int] = mapped_column(default=8888)
    port_shadowsocks: Mapped[int] = mapped_column(default=8388)
    port_control: Mapped[int] = mapped_column(default=8001)
    extra_ports: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSON, nullable=True
    )
    container_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created")
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = mapped_column(server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        onupdate=func.now(), nullable=True
    )
