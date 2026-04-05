import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.app_settings import AppSettings
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

O11_KEYS = ("o11_url", "o11_username", "o11_password", "o11_provider_id")


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


def _get_o11_instances(db: Session) -> list[dict]:
    """Load O11 instances from DB. Migrates legacy single-instance format."""
    raw = _get_setting(db, "o11_instances")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass

    # Migrate legacy single-instance keys
    url = _get_setting(db, "o11_url")
    username = _get_setting(db, "o11_username")
    password = _get_setting(db, "o11_password")
    provider_id = _get_setting(db, "o11_provider_id")
    if url:
        instance = {
            "id": str(uuid.uuid4()),
            "name": "Default",
            "url": url,
            "username": username,
            "password": password,
            "provider_id": provider_id,
        }
        _set_setting(db, "o11_instances", json.dumps([instance]))
        return [instance]

    return []


def _save_o11_instances(db: Session, instances: list[dict]):
    _set_setting(db, "o11_instances", json.dumps(instances))


# --- Legacy single-instance endpoints (backward compatible) ---


@router.get("/o11")
def get_o11_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get O11 monitoring settings (first instance, backward compatible)."""
    instances = _get_o11_instances(db)
    if not instances:
        return {
            "o11_url": "",
            "o11_username": "",
            "o11_password": "",
            "o11_provider_id": "",
            "configured": False,
        }
    inst = instances[0]
    return {
        "o11_url": inst.get("url", ""),
        "o11_username": inst.get("username", ""),
        "o11_password": "••••••••" if inst.get("password") else "",
        "o11_provider_id": inst.get("provider_id", ""),
        "configured": bool(
            inst.get("url") and inst.get("username") and inst.get("password")
        ),
    }


@router.put("/o11")
def update_o11_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update O11 monitoring settings (first instance, backward compatible)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    instances = _get_o11_instances(db)
    if instances:
        inst = instances[0]
    else:
        inst = {"id": str(uuid.uuid4()), "name": "Default"}
        instances = [inst]

    if "o11_url" in data:
        inst["url"] = data["o11_url"].rstrip("/")
    if "o11_username" in data:
        inst["username"] = data["o11_username"]
    if "o11_password" in data and data["o11_password"] != "••••••••":
        inst["password"] = data["o11_password"]
    if "o11_provider_id" in data:
        inst["provider_id"] = data["o11_provider_id"]

    instances[0] = inst
    _save_o11_instances(db, instances)

    from app.services import monitoring_service

    monitoring_service.reload_credentials()

    return {"status": "ok"}


@router.post("/o11/test")
def test_o11_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test O11 connection using saved settings (first instance)."""
    from app.services import monitoring_service

    instances = _get_o11_instances(db)
    if not instances:
        return {"success": False, "error": "O11 settings not configured"}
    inst = instances[0]
    url = inst.get("url", "")
    username = inst.get("username", "")
    password = inst.get("password", "")
    if not all([url, username, password]):
        return {"success": False, "error": "O11 settings not configured"}
    try:
        monitoring_service.test_connection(url, username, password)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Multi-instance endpoints ---


@router.get("/o11/instances")
def get_o11_instances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all O11 monitoring instances (passwords masked)."""
    instances = _get_o11_instances(db)
    return [
        {
            "id": inst.get("id", ""),
            "name": inst.get("name", ""),
            "url": inst.get("url", ""),
            "username": inst.get("username", ""),
            "password": "••••••••" if inst.get("password") else "",
            "provider_id": inst.get("provider_id", ""),
            "configured": bool(
                inst.get("url") and inst.get("username") and inst.get("password")
            ),
        }
        for inst in instances
    ]


@router.post("/o11/instances")
def add_o11_instance(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new O11 monitoring instance."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    instances = _get_o11_instances(db)
    new_inst = {
        "id": str(uuid.uuid4()),
        "name": (data.get("name") or "").strip() or f"Instance {len(instances) + 1}",
        "url": (data.get("url") or "").rstrip("/"),
        "username": data.get("username", ""),
        "password": data.get("password", ""),
        "provider_id": data.get("provider_id", ""),
    }
    instances.append(new_inst)
    _save_o11_instances(db, instances)

    from app.services import monitoring_service

    monitoring_service.reload_credentials()

    return {"status": "ok", "id": new_inst["id"]}


@router.put("/o11/instances/{instance_id}")
def update_o11_instance(
    instance_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing O11 monitoring instance."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    instances = _get_o11_instances(db)
    inst = next((i for i in instances if i.get("id") == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    if "name" in data:
        inst["name"] = (data["name"] or "").strip()
    if "url" in data:
        inst["url"] = (data["url"] or "").rstrip("/")
    if "username" in data:
        inst["username"] = data["username"]
    if "password" in data and data["password"] != "••••••••":
        inst["password"] = data["password"]
    if "provider_id" in data:
        inst["provider_id"] = data["provider_id"]

    _save_o11_instances(db, instances)

    from app.services import monitoring_service

    monitoring_service.reload_credentials()

    return {"status": "ok"}


@router.delete("/o11/instances/{instance_id}")
def delete_o11_instance(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an O11 monitoring instance."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    instances = _get_o11_instances(db)
    new_instances = [i for i in instances if i.get("id") != instance_id]
    if len(new_instances) == len(instances):
        raise HTTPException(status_code=404, detail="Instance not found")

    _save_o11_instances(db, new_instances)

    from app.services import monitoring_service

    monitoring_service.reload_credentials()

    return {"status": "ok"}


@router.post("/o11/instances/{instance_id}/test")
def test_o11_instance(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test connection for a specific O11 instance."""
    from app.services import monitoring_service

    instances = _get_o11_instances(db)
    inst = next((i for i in instances if i.get("id") == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    url = inst.get("url", "")
    username = inst.get("username", "")
    password = inst.get("password", "")
    if not all([url, username, password]):
        return {"success": False, "error": "Instance not fully configured"}

    try:
        monitoring_service.test_connection(url, username, password)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- Container Images settings ---

DEFAULT_GLUETUN_IMAGE = "qmcgaw/gluetun:latest"


@router.get("/container-images")
def get_container_images(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get predefined container images for Gluetun and O11."""
    gluetun_image = _get_setting(db, "gluetun_image") or DEFAULT_GLUETUN_IMAGE
    o11_images_raw = _get_setting(db, "o11_images")
    o11_images = []
    if o11_images_raw:
        try:
            o11_images = json.loads(o11_images_raw)
        except Exception:
            pass
    return {
        "gluetun_image": gluetun_image,
        "o11_images": o11_images,
    }


@router.put("/container-images")
def update_container_images(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update predefined container images."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    if "gluetun_image" in data:
        image = (data["gluetun_image"] or "").strip()
        _set_setting(db, "gluetun_image", image if image else DEFAULT_GLUETUN_IMAGE)

    if "o11_images" in data:
        images = data["o11_images"]
        if isinstance(images, list):
            # Filter out empty strings
            clean = [
                img.strip() for img in images if isinstance(img, str) and img.strip()
            ]
            _set_setting(db, "o11_images", json.dumps(clean))

    return {"status": "ok"}


# --- Portainer URL setting ---


@router.get("/portainer-url")
def get_portainer_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the configured Portainer URL."""
    return {"portainer_url": _get_setting(db, "portainer_url")}


@router.put("/portainer-url")
def update_portainer_url(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the Portainer URL."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    url = (data.get("portainer_url") or "").strip().rstrip("/")
    _set_setting(db, "portainer_url", url)
    return {"status": "ok"}
