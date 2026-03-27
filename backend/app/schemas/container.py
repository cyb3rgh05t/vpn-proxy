from pydantic import BaseModel, field_validator
from typing import Optional
import re


class ContainerCreate(BaseModel):
    name: str
    vpn_provider: str
    vpn_type: str = "openvpn"
    config: dict = {}
    port_http_proxy: int = 8888
    port_shadowsocks: int = 8388
    port_control: int = 8001

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
    port_control: Optional[int] = None


class ContainerResponse(BaseModel):
    id: int
    name: str
    vpn_provider: str
    vpn_type: str
    config: dict
    port_http_proxy: int
    port_shadowsocks: int
    port_control: int
    container_id: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ContainerLogsResponse(BaseModel):
    logs: str


class ContainerStatusResponse(BaseModel):
    status: str
    container_id: Optional[str] = None
    ip_address: Optional[str] = None
