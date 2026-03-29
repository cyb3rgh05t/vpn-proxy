from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class APIKeyCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 1 or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v


class APIKeyResponse(BaseModel):
    id: int
    name: str
    key_preview: str
    is_active: bool
    created_by: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class APIKeyCreatedResponse(BaseModel):
    id: int
    name: str
    key: str
    is_active: bool
    created_by: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
