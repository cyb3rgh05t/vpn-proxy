import base64
import json
import logging
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.api_key import APIKey
from app.models.app_settings import AppSettings
from app.models.o11_container import O11Container
from app.models.user import User
from app.models.vpn_container import VPNContainer
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])

BACKUP_DIR = os.path.join(settings.DATA_DIR, "backups")
BACKUP_VERSION = "1.1"
MAX_BACKUPS = 20  # prevent unbounded disk usage
_SAFE_FILENAME = re.compile(r"^[\w\-. ]+\.json$")
_SAFE_CONTAINER_NAME = re.compile(r"^[a-zA-Z0-9_-]+$")
MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50 MB (cert files can be large)


def _ensure_backup_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def _read_cert_files(container_name: str) -> list[dict]:
    """Read all files from data/gluetun/<name>/ and return as base64-encoded entries."""
    cert_dir = os.path.join(
        os.path.abspath(settings.DATA_DIR), "gluetun", container_name
    )
    if not os.path.isdir(cert_dir):
        return []
    files = []
    for fname in os.listdir(cert_dir):
        fpath = os.path.join(cert_dir, fname)
        if os.path.isfile(fpath):
            try:
                with open(fpath, "rb") as fh:
                    files.append(
                        {
                            "filename": fname,
                            "data_b64": base64.b64encode(fh.read()).decode("ascii"),
                        }
                    )
            except OSError:
                pass
    return files


def _restore_cert_files(container_name: str, files: list[dict]) -> int:
    """Write base64-encoded cert files back to data/gluetun/<name>/."""
    if not files:
        return 0
    if not _SAFE_CONTAINER_NAME.match(container_name):
        return 0
    cert_dir = os.path.join(
        os.path.abspath(settings.DATA_DIR), "gluetun", container_name
    )
    os.makedirs(cert_dir, exist_ok=True)
    written = 0
    for entry in files:
        fname = os.path.basename(entry.get("filename", ""))
        b64 = entry.get("data_b64", "")
        if not fname or not b64:
            continue
        try:
            raw = base64.b64decode(b64)
            with open(os.path.join(cert_dir, fname), "wb") as fh:
                fh.write(raw)
            written += 1
        except Exception:
            pass
    return written


def _build_snapshot(db: Session) -> dict:
    """Collect all exportable data from the database."""
    settings_rows = db.query(AppSettings).all()
    vpn_containers = db.query(VPNContainer).all()
    o11_containers = db.query(O11Container).all()
    users = db.query(User).all()
    api_keys = db.query(APIKey).all()

    vpn_container_list = []
    for c in vpn_containers:
        vpn_container_list.append(
            {
                "name": c.name,
                "description": c.description,
                "vpn_provider": c.vpn_provider,
                "vpn_type": c.vpn_type,
                "config": c.config,
                "port_http_proxy": c.port_http_proxy,
                "port_shadowsocks": c.port_shadowsocks,
                "port_control": c.port_control,
                "socks5_enabled": c.socks5_enabled,
                "port_socks5": c.port_socks5,
                "extra_ports": c.extra_ports,
                "network_name": c.network_name,
                "cert_files": _read_cert_files(c.name),
            }
        )

    return {
        "version": BACKUP_VERSION,
        "app": "vpn-proxy",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": [{"key": r.key, "value": r.value} for r in settings_rows],
        "vpn_containers": vpn_container_list,
        "o11_containers": [
            {
                "name": c.name,
                "description": c.description,
                "image": c.image,
                "network_mode": c.network_mode,
                "environment": c.environment,
                "ports": c.ports,
                "volumes": c.volumes,
                "restart_policy": c.restart_policy,
                "command": c.command,
            }
            for c in o11_containers
        ],
        "users": [
            {
                "username": u.username,
                "hashed_password": u.hashed_password,
                "is_admin": u.is_admin,
            }
            for u in users
        ],
        "api_keys": [
            {
                "key": k.key,
                "name": k.name,
                "is_active": k.is_active,
            }
            for k in api_keys
        ],
    }


def _restore_snapshot(db: Session, data: dict, restore_user_id: int) -> dict:
    """Restore settings, containers, users and API keys from a backup snapshot."""
    restored = {
        "settings": 0,
        "vpn_containers": 0,
        "o11_containers": 0,
        "users": 0,
        "api_keys": 0,
        "cert_files": 0,
    }

    # --- Settings ---
    for item in data.get("settings", []):
        key = item.get("key")
        value = item.get("value")
        if not key:
            continue
        row = db.query(AppSettings).filter(AppSettings.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSettings(key=key, value=value))
        restored["settings"] += 1

    # --- VPN Containers ---
    for item in data.get("vpn_containers", []):
        name = item.get("name")
        if not name:
            continue
        existing = db.query(VPNContainer).filter(VPNContainer.name == name).first()
        if existing:
            for field in (
                "description",
                "vpn_provider",
                "vpn_type",
                "config",
                "port_http_proxy",
                "port_shadowsocks",
                "port_control",
                "socks5_enabled",
                "port_socks5",
                "extra_ports",
                "network_name",
            ):
                if field in item:
                    setattr(existing, field, item[field])
        else:
            db.add(
                VPNContainer(
                    name=name,
                    description=item.get("description"),
                    vpn_provider=item.get("vpn_provider", ""),
                    vpn_type=item.get("vpn_type", "openvpn"),
                    config=item.get("config", {}),
                    port_http_proxy=item.get("port_http_proxy", 8888),
                    port_shadowsocks=item.get("port_shadowsocks", 8388),
                    port_control=item.get("port_control", 8000),
                    socks5_enabled=item.get("socks5_enabled", False),
                    port_socks5=item.get("port_socks5", 1080),
                    extra_ports=item.get("extra_ports"),
                    network_name=item.get("network_name"),
                    status="created",
                )
            )
        restored["vpn_containers"] += 1

    # --- O11 Containers ---
    for item in data.get("o11_containers", []):
        name = item.get("name")
        if not name:
            continue
        existing = db.query(O11Container).filter(O11Container.name == name).first()
        if existing:
            for field in (
                "description",
                "image",
                "network_mode",
                "environment",
                "ports",
                "volumes",
                "restart_policy",
                "command",
            ):
                if field in item:
                    setattr(existing, field, item[field])
        else:
            db.add(
                O11Container(
                    name=name,
                    description=item.get("description"),
                    image=item.get("image"),
                    network_mode=item.get("network_mode"),
                    environment=item.get("environment", {}),
                    ports=item.get("ports", {}),
                    volumes=item.get("volumes", []),
                    restart_policy=item.get("restart_policy", "unless-stopped"),
                    command=item.get("command"),
                    status="created",
                )
            )
        restored["o11_containers"] += 1

    # --- Users ---
    for item in data.get("users", []):
        username = (item.get("username") or "").strip()
        hashed_password = item.get("hashed_password", "")
        if not username or not hashed_password:
            continue
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            # Update password hash only (preserve admin flag if already set)
            existing.hashed_password = hashed_password
            existing.is_admin = item.get("is_admin", existing.is_admin)
        else:
            db.add(
                User(
                    username=username,
                    hashed_password=hashed_password,
                    is_admin=item.get("is_admin", False),
                )
            )
        restored["users"] += 1

    # --- API Keys ---
    for item in data.get("api_keys", []):
        key_hash = item.get("key", "")
        name = (item.get("name") or "").strip()
        if not key_hash or not name:
            continue
        existing = db.query(APIKey).filter(APIKey.key == key_hash).first()
        if existing:
            existing.name = name
            existing.is_active = item.get("is_active", existing.is_active)
        else:
            db.add(
                APIKey(
                    key=key_hash,
                    name=name,
                    is_active=item.get("is_active", True),
                    created_by=restore_user_id,
                )
            )
        restored["api_keys"] += 1

    db.commit()

    # --- VPN Cert files (written after DB commit) ---
    for item in data.get("vpn_containers", []):
        name = item.get("name")
        cert_files = item.get("cert_files", [])
        if name and cert_files:
            restored["cert_files"] += _restore_cert_files(name, cert_files)

    return restored


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/export")
def export_backup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the full backup as a downloadable JSON file."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    snapshot = _build_snapshot(db)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"vpnproxy_backup_{timestamp}.json"
    return JSONResponse(
        content=snapshot,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore settings and containers from an uploaded backup JSON file."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=400, detail="Only .json backup files are accepted"
        )

    raw = await file.read()
    if len(raw) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=400, detail="Backup file too large (max 50 MB)")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if data.get("app") != "vpn-proxy":
        raise HTTPException(status_code=400, detail="Not a valid vpn-proxy backup file")

    restored = _restore_snapshot(db, data, current_user.id)
    logger.info(
        "Backup restored by %s: %s settings, %s VPN, %s O11, %s users, %s API keys, %s cert files",
        current_user.username,
        restored["settings"],
        restored["vpn_containers"],
        restored["o11_containers"],
        restored["users"],
        restored["api_keys"],
        restored["cert_files"],
    )
    return {"status": "ok", "restored": restored}


@router.post("/save")
def save_backup(
    data: dict | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save the current state as a named backup file on the server."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    _ensure_backup_dir()

    label = ""
    if data:
        label = (data.get("label") or "").strip()
    # Sanitise label: allow letters, digits, spaces, hyphens, underscores
    label = re.sub(r"[^\w\- ]", "", label)[:50]

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    if label:
        filename = f"vpnproxy_{timestamp}_{label}.json"
    else:
        filename = f"vpnproxy_{timestamp}.json"

    # Enforce max backup count (oldest first)
    existing = sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")],
    )
    while len(existing) >= MAX_BACKUPS:
        os.remove(os.path.join(BACKUP_DIR, existing.pop(0)))

    snapshot = _build_snapshot(db)
    path = os.path.join(BACKUP_DIR, filename)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, ensure_ascii=False, indent=2)

    logger.info("Server backup saved by %s: %s", current_user.username, filename)
    return {"status": "ok", "filename": filename}


@router.get("/list")
def list_backups(
    current_user: User = Depends(get_current_user),
):
    """List all server-side backup files."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    _ensure_backup_dir()
    files = sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")],
        reverse=True,
    )
    result = []
    for f in files:
        path = os.path.join(BACKUP_DIR, f)
        stat = os.stat(path)
        result.append(
            {
                "filename": f,
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            }
        )
    return result


@router.get("/download/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Download a specific server-side backup file."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")

    return FileResponse(path, media_type="application/json", filename=filename)


@router.delete("/{filename}")
def delete_backup(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a specific server-side backup file."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")

    os.remove(path)
    logger.info("Server backup deleted by %s: %s", current_user.username, filename)
    return {"status": "ok"}
