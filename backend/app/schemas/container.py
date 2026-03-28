from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import datetime
import re


class ContainerCreate(BaseModel):
    name: str
    vpn_provider: str
    vpn_type: str = "openvpn"
    config: dict = {}
    port_http_proxy: int = 8888
    port_shadowsocks: int = 8388
    extra_ports: list[dict] = []
    network_name: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or len(v) < 2 or len(v) > 50:
            raise ValueError("Name must be 2-50 characters")
        if not re.match(r"^[a-z0-9][a-z0-9_-]*$", v):
            raise ValueError(
                "Name must start with alphanumeric and contain only lowercase letters, numbers, hyphens, underscores"
            )
        return v

    @field_validator("vpn_type")
    @classmethod
    def validate_vpn_type(cls, v: str) -> str:
        if v not in ("openvpn", "wireguard"):
            raise ValueError("VPN type must be 'openvpn' or 'wireguard'")
        return v


class ContainerUpdate(BaseModel):
    vpn_provider: Optional[str] = None
    vpn_type: Optional[str] = None
    config: Optional[dict] = None
    port_http_proxy: Optional[int] = None
    port_shadowsocks: Optional[int] = None
    extra_ports: Optional[list[dict]] = None
    description: Optional[str] = None
    network_name: Optional[str] = None


class ContainerResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    vpn_provider: str
    vpn_type: str
    config: dict
    port_http_proxy: int
    port_shadowsocks: int
    port_control: int = 8000
    extra_ports: Optional[list[dict]] = []
    container_id: Optional[str] = None
    docker_name: Optional[str] = None
    network_name: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def filter_config_keys(self) -> "ContainerResponse":
        from app.services.docker_service import filter_config

        self.config = filter_config(self.config)
        return self


class ContainerLogsResponse(BaseModel):
    logs: str


class ContainerStatusResponse(BaseModel):
    status: str
    container_id: Optional[str] = None
    ip_address: Optional[str] = None
