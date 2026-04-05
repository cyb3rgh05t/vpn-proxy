import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.api_key import APIKey
from app.models.user import User
from app.schemas.api_key import APIKeyCreate, APIKeyResponse, APIKeyCreatedResponse
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


def _mask_key(key: str) -> str:
    """Show first 8 and last 4 characters, mask the rest."""
    if len(key) <= 12:
        return key
    return key[:8] + "..." + key[-4:]


@router.get("", response_model=list[APIKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all API keys for the current user (admins see all)."""
    if current_user.is_admin:
        keys = db.query(APIKey).all()
    else:
        keys = db.query(APIKey).filter(APIKey.created_by == current_user.id).all()

    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            key_preview=_mask_key(k.key),
            is_active=k.is_active,
            created_by=k.created_by,
            created_at=k.created_at,
        )
        for k in keys
    ]


@router.post("", response_model=APIKeyCreatedResponse, status_code=201)
def create_api_key(
    req: APIKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new API key. The full key is only shown once."""
    raw_key = secrets.token_hex(32)  # 64-char hex string
    api_key = APIKey(
        key=raw_key,
        name=req.name,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,
        is_active=api_key.is_active,
        created_by=api_key.created_by,
        created_at=api_key.created_at,
    )


@router.delete("/{key_id}")
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke (delete) an API key."""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    if not current_user.is_admin and api_key.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to revoke this key",
        )
    db.delete(api_key)
    db.commit()
    return {"message": "API key revoked"}
