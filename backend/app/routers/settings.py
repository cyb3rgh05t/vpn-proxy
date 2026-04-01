import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.app_settings import AppSettings
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

O11_KEYS = ("o11_url", "o11_username", "o11_password")


def _get_setting(db: Session, key: str) -> str:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return (row.value or "") if row else ""


def _set_setting(db: Session, key: str, value: str):
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))
    db.commit()


@router.get("/o11")
def get_o11_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get O11 monitoring settings (password masked)."""
    url = _get_setting(db, "o11_url")
    username = _get_setting(db, "o11_username")
    password = _get_setting(db, "o11_password")
    return {
        "o11_url": url,
        "o11_username": username,
        "o11_password": "••••••••" if password else "",
        "configured": bool(url and username and password),
    }


@router.put("/o11")
def update_o11_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update O11 monitoring settings."""
    if not current_user.is_admin:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Admin only")

    if "o11_url" in data:
        _set_setting(db, "o11_url", data["o11_url"].rstrip("/"))
    if "o11_username" in data:
        _set_setting(db, "o11_username", data["o11_username"])
    if "o11_password" in data and data["o11_password"] != "••••••••":
        _set_setting(db, "o11_password", data["o11_password"])

    # Reload credentials in the monitoring service
    from app.services import monitoring_service

    monitoring_service.reload_credentials()

    return {"status": "ok"}


@router.post("/o11/test")
def test_o11_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test O11 connection using saved settings."""
    from app.services import monitoring_service

    url = _get_setting(db, "o11_url")
    username = _get_setting(db, "o11_username")
    password = _get_setting(db, "o11_password")

    if not all([url, username, password]):
        return {"success": False, "error": "O11 settings not configured"}

    try:
        monitoring_service.test_connection(url, username, password)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
