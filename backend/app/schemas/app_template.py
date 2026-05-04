from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class AppTemplateBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=500)
    image: str = Field(..., min_length=1, max_length=300)
    suggested_name: Optional[str] = Field(default=None, max_length=150)
    restart_policy: Optional[str] = Field(default="unless-stopped", max_length=50)
    env_vars: Optional[list[dict[str, Any]]] = Field(default_factory=list)
    ports: Optional[list[dict[str, Any]]] = Field(default_factory=list)
    volumes: Optional[list[dict[str, Any]]] = Field(default_factory=list)
    devices: Optional[list[str]] = Field(default_factory=list)
    labels: Optional[list[dict[str, str]]] = Field(default_factory=list)


class AppTemplateCreate(AppTemplateBase):
    id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")


class AppTemplateUpdate(AppTemplateBase):
    pass


class AppTemplate(AppTemplateBase):
    id: str
    is_builtin: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
