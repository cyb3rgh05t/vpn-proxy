import logging
import os
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.vpn_container import VPNContainer
from app.models.o11_container import O11Container
from app.schemas.container import (
    ContainerCreate,
    ContainerUpdate,
    ContainerResponse,
    ContainerLogsResponse,
    ContainerStatusResponse,
)
from app.services import docker_service
from app.services.providers import (
    VPN_PROVIDERS,
    get_provider_list,
    get_provider_fields,
    get_gluetun_env_variables,
)
from app.models.app_settings import AppSettings
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/containers", tags=["containers"])


def _resolve_dependent_data_dir(
    name: str, kind: str = "o11", host: bool = False
) -> str:
    """Return the data directory for a dependent container.

    kind="o11" -> <DATA_DIR>/o11/<name>   (OTT panels)
    kind="apps" -> <DATA_DIR>/apps/<name> (App-Catalog apps)
    If host=True and HOST_DATA_DIR is set, use the host-side path instead.
    """
    sub = "apps" if kind == "apps" else "o11"
    if host and settings.HOST_DATA_DIR:
        return os.path.join(settings.HOST_DATA_DIR, sub, name)
    return os.path.join(os.path.abspath(settings.DATA_DIR), sub, name)


def _get_gluetun_image(db: Session) -> str:
    """Get the configured Gluetun image from DB, falling back to config default."""
    row = db.query(AppSettings).filter(AppSettings.key == "gluetun_image").first()
    return (row.value or settings.GLUETUN_IMAGE) if row else settings.GLUETUN_IMAGE


@router.post("/discover")
def discover_and_import(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Discover existing Gluetun containers and import them into the database."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    try:
        discovered = docker_service.discover_gluetun_containers()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    imported = 0
    skipped = 0
    for info in discovered:
        # Skip if container_id already tracked
        existing = (
            db.query(VPNContainer)
            .filter(
                (VPNContainer.container_id == info["container_id"])
                | (VPNContainer.name == info["name"])
            )
            .first()
        )
        if existing:
            # Update container_id if name matches but container_id is missing
            if existing.container_id != info["container_id"]:
                existing.container_id = info["container_id"]
                existing.status = info["status"]
                db.commit()
            # Update network_name if not yet set
            if not existing.network_name and info.get("network_name"):
                existing.network_name = info["network_name"]
                db.commit()
            skipped += 1
            continue

        vpn_container = VPNContainer(
            name=info["name"],
            vpn_provider=info["vpn_provider"],
            vpn_type=info["vpn_type"],
            config=info["config"],
            port_http_proxy=info["port_http_proxy"],
            port_shadowsocks=info["port_shadowsocks"],
            port_control=info["port_control"],
            network_name=info.get("network_name"),
            container_id=info["container_id"],
            status=info["status"],
            created_by=current_user.id,
        )
        db.add(vpn_container)
        db.commit()
        imported += 1
    return {
        "message": f"Discovered {len(discovered)} Gluetun containers. Imported {imported}, skipped {skipped} (already tracked).",
        "discovered": len(discovered),
        "imported": imported,
        "skipped": skipped,
    }


@router.get("/providers")
def list_providers():
    return get_provider_list()


@router.get("/env-variables")
def list_env_variables():
    return get_gluetun_env_variables()


@router.get("/networks")
def list_networks(
    current_user: User = Depends(get_current_user),
):
    """List available Docker networks."""
    try:
        return docker_service.list_docker_networks()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/volumes")
def list_volumes(
    current_user: User = Depends(get_current_user),
):
    """List available Docker named volumes."""
    try:
        return docker_service.list_docker_volumes()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.post("/volumes")
def create_volume(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Create a named Docker volume.

    Body: { name, driver?, driver_opts?, labels? }
    Example for local-persist:
      { "name": "unionfs", "driver": "local-persist",
        "driver_opts": {"mountpoint": "/mnt"} }
    """
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Volume name is required")
    try:
        return docker_service.create_docker_volume(
            name=name,
            driver=(body.get("driver") or "local").strip(),
            driver_opts=body.get("driver_opts") or None,
            labels=body.get("labels") or None,
        )
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create volume: {e}")


@router.delete("/volumes/{name}")
def delete_volume(
    name: str,
    force: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Delete a named Docker volume."""
    try:
        docker_service.remove_docker_volume(name, force=force)
        return {"ok": True, "message": f"Volume '{name}' removed"}
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove volume: {e}")


@router.get("/stacks")
def list_stacks(
    current_user: User = Depends(get_current_user),
):
    """List available Docker Compose stacks."""
    try:
        return docker_service.list_docker_stacks()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/dependents")
def list_all_dependents(
    current_user: User = Depends(get_current_user),
):
    """List all Docker containers (non-Gluetun) with VPN connection info."""
    try:
        return docker_service.list_all_docker_containers()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/dependents/debug")
def debug_dependents():
    """Debug endpoint: show VPN detection details for all containers. No auth required."""
    try:
        return docker_service.list_all_docker_containers_debug()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/dependents/db-info-batch")
def get_all_o11_db_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return DB info (description etc.) for all O11 containers, keyed by name."""
    records = db.query(O11Container).all()
    return {
        r.name: {
            "description": r.description,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    }


@router.post("/dependents/create")
def create_o11_container(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new O11 (generic Docker) container."""
    name = (body.get("name") or "").strip()
    image = (body.get("image") or "").strip()
    # Strip common prefixes if user pastes a full docker pull command
    if image.lower().startswith("docker pull "):
        image = image[len("docker pull ") :].strip()
    if not name:
        raise HTTPException(status_code=400, detail="Container name is required")
    if not image:
        raise HTTPException(status_code=400, detail="Docker image is required")

    # Check if container with this name already exists
    try:
        client = docker_service._get_client()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    try:
        client.containers.get(name)
        raise HTTPException(
            status_code=409,
            detail=f"Container with name '{name}' already exists",
        )
    except docker_service.NotFound:
        pass

    try:
        container_id = docker_service.create_o11_container(
            name=name,
            image=image,
            network_mode=body.get("network_mode", "bridge"),
            environment=body.get("environment"),
            ports=body.get("ports"),
            volumes=body.get("volumes"),
            devices=body.get("devices") or None,
            restart_policy=body.get("restart_policy", "unless-stopped"),
            command=body.get("command"),
            labels=body.get("labels"),
            hostname=body.get("hostname") or None,
            custom_labels=body.get("custom_labels") or None,
            cap_add=body.get("cap_add") or None,
            security_opt=body.get("security_opt") or None,
            extra_hosts=body.get("extra_hosts") or None,
        )

        # Save to database
        o11_record = O11Container(
            name=name,
            image=image,
            network_mode=body.get("network_mode", "bridge"),
            environment=body.get("environment"),
            ports=body.get("ports"),
            volumes=body.get("volumes"),
            devices=body.get("devices") or None,
            restart_policy=body.get("restart_policy", "unless-stopped"),
            command=body.get("command"),
            hostname=body.get("hostname") or None,
            custom_labels=body.get("custom_labels") or None,
            cap_add=body.get("cap_add") or None,
            security_opt=body.get("security_opt") or None,
            container_id=container_id,
            status="created",
            created_by=current_user.id,
        )
        db.add(o11_record)
        db.commit()

        return {
            "message": f"Container '{name}' created successfully",
            "container_id": container_id,
            "name": name,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create O11 container %s: %s", name, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create container: {e}",
        )


@router.get("/dependents/images")
def list_docker_images(
    current_user: User = Depends(get_current_user),
):
    """List locally available Docker images."""
    client = docker_service._get_client()
    images = []
    try:
        for img in client.images.list():
            tags = img.tags or []
            for tag in tags:
                images.append(tag)
    except Exception as e:
        logger.error("Failed to list Docker images: %s", e)
    return sorted(images)


@router.get("/dependents/data-path/{name}")
def get_o11_data_path(
    name: str,
    kind: str = "o11",
    current_user: User = Depends(get_current_user),
):
    """Get the host-side data path for a dependent container (volume mount hints).

    kind="o11" (default) for OTT panels, kind="apps" for App-Catalog apps.
    """
    import re

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise HTTPException(status_code=400, detail="Invalid container name")
    if kind not in ("o11", "apps"):
        raise HTTPException(status_code=400, detail="Invalid kind")

    base = _resolve_dependent_data_dir(name, kind=kind, host=True)
    return {"base_path": base.replace("\\", "/"), "kind": kind}


ALLOWED_O11_EXTENSIONS = {
    ".ovpn",
    ".conf",
    ".key",
    ".crt",
    ".pem",
    ".txt",
    ".cfg",
    ".xml",
    ".json",
    ".yaml",
    ".yml",
    ".ini",
    ".toml",
    ".sh",
    ".bat",
    ".env",
    ".csv",
    ".log",
    ".properties",
    ".html",
    ".css",
    ".js",
    ".py",
    ".lua",
}
MAX_O11_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/dependents/upload-files/{name}")
async def upload_o11_file(
    name: str,
    file: UploadFile = File(...),
    target_path: str = "",
    kind: str = "o11",
    current_user: User = Depends(get_current_user),
):
    """Upload a file for a dependent container with optional target path (subdirectory)."""
    import re

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise HTTPException(status_code=400, detail="Invalid container name")
    if kind not in ("o11", "apps"):
        raise HTTPException(status_code=400, detail="Invalid kind")

    # Validate and sanitize target_path (e.g. "scripts", "config")
    target_path = target_path.strip().strip("/")
    if target_path:
        # Prevent path traversal
        if ".." in target_path or target_path.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid target path")
        # Only allow simple subdirectory names
        if not re.match(r"^[a-zA-Z0-9_/.-]+$", target_path):
            raise HTTPException(
                status_code=400, detail="Invalid target path characters"
            )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    filename = os.path.basename(file.filename)
    _, ext = os.path.splitext(filename)
    if ext and ext.lower() not in ALLOWED_O11_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_O11_EXTENSIONS))}, or no extension",
        )

    content = await file.read()
    if len(content) > MAX_O11_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 100 MB)")

    # Save to data/{kind}/{name}/{target_path}/
    o11_data = _resolve_dependent_data_dir(name, kind=kind, host=False)
    if target_path:
        o11_data = os.path.join(o11_data, target_path)
    os.makedirs(o11_data, exist_ok=True)
    dest = os.path.join(o11_data, filename)
    with open(dest, "wb") as f:
        f.write(content)

    stored_path = f"{target_path}/{filename}" if target_path else filename
    logger.info(
        "Uploaded file '%s' for %s container '%s' (target: %s)",
        filename,
        kind,
        name,
        target_path or "/",
    )
    return {
        "message": f"Uploaded {filename}",
        "filename": filename,
        "size": len(content),
        "target_path": target_path,
        "stored_path": stored_path,
    }


@router.get("/dependents/files/{name}")
def list_o11_files(
    name: str,
    kind: str = "o11",
    current_user: User = Depends(get_current_user),
):
    """List uploaded files for a dependent container (recursively including subdirs)."""
    import re

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise HTTPException(status_code=400, detail="Invalid container name")
    if kind not in ("o11", "apps"):
        raise HTTPException(status_code=400, detail="Invalid kind")

    o11_data = _resolve_dependent_data_dir(name, kind=kind, host=False)
    if not os.path.isdir(o11_data):
        return []

    files = []
    for root, _dirs, filenames in os.walk(o11_data):
        for fname in filenames:
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, o11_data).replace("\\", "/")
            # Extract target_path (subdirectory part)
            parts = rel_path.rsplit("/", 1)
            target_path = parts[0] if len(parts) > 1 else ""
            files.append(
                {
                    "name": fname,
                    "size": os.path.getsize(fpath),
                    "target_path": target_path,
                    "stored_path": rel_path,
                }
            )
    return files


@router.delete("/dependents/files/{name}/{filepath:path}")
def delete_o11_file(
    name: str,
    filepath: str,
    kind: str = "o11",
    current_user: User = Depends(get_current_user),
):
    """Delete an uploaded file for a dependent container (supports subdirectory paths)."""
    import re

    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise HTTPException(status_code=400, detail="Invalid container name")
    if kind not in ("o11", "apps"):
        raise HTTPException(status_code=400, detail="Invalid kind")

    # Prevent path traversal
    if ".." in filepath:
        raise HTTPException(status_code=400, detail="Invalid file path")

    o11_data = _resolve_dependent_data_dir(name, kind=kind, host=False)
    fpath = os.path.join(o11_data, filepath)

    # Verify the resolved path is still within o11_data
    if not os.path.abspath(fpath).startswith(os.path.abspath(o11_data)):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(fpath)

    # Clean up empty parent directories
    parent = os.path.dirname(fpath)
    while parent != o11_data and os.path.isdir(parent) and not os.listdir(parent):
        os.rmdir(parent)
        parent = os.path.dirname(parent)

    logger.info("Deleted file '%s' for %s container '%s'", filepath, kind, name)
    return {"message": f"Deleted {filepath}"}


@router.get("/dependents/{container_name}/db-info")
def get_o11_db_info(
    container_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the database record for an O11 container."""
    record = db.query(O11Container).filter(O11Container.name == container_name).first()
    if not record:
        return {"description": None}
    return {
        "id": record.id,
        "name": record.name,
        "description": record.description,
        "image": record.image,
        "network_mode": record.network_mode,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


@router.put("/dependents/{container_name}/description")
def update_o11_description(
    container_name: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the description of an O11 container."""
    record = db.query(O11Container).filter(O11Container.name == container_name).first()
    if not record:
        # Auto-create a minimal record if container exists in Docker but not in DB
        record = O11Container(name=container_name)
        db.add(record)

    desc = (body.get("description") or "").strip() or None
    record.description = desc
    db.commit()
    return {"message": "Description updated", "description": record.description}


@router.post("/dependents/{container_name}/network-mode")
def change_dependent_network_mode(
    container_name: str,
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Change the network_mode of a container by recreating it."""
    new_network_mode = body.get("network_mode", "").strip()
    if not new_network_mode:
        raise HTTPException(status_code=400, detail="network_mode is required")
    try:
        result = docker_service.change_container_network_mode(
            container_name, new_network_mode
        )
        return result
    except Exception as e:
        logger.error("Failed to change network_mode for %s: %s", container_name, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dependents/{container_name}/redeploy")
def redeploy_dependent(
    container_name: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Redeploy an O11 container with updated configuration."""
    try:
        new_container_id = docker_service.redeploy_o11_container(
            container_name=container_name,
            image=body.get("image"),
            environment=body.get("environment"),
            ports=body.get("ports"),
            volumes=body.get("volumes"),
            restart_policy=body.get("restart_policy"),
            command=body.get("command"),
        )

        # Update database record if it exists
        record = (
            db.query(O11Container).filter(O11Container.name == container_name).first()
        )
        if record:
            if body.get("image"):
                record.image = body["image"]
            if body.get("environment") is not None:
                record.environment = body["environment"]
            if body.get("ports") is not None:
                record.ports = body["ports"]
            if body.get("volumes") is not None:
                record.volumes = body["volumes"]
            if body.get("restart_policy") is not None:
                record.restart_policy = body["restart_policy"]
            if body.get("command") is not None:
                record.command = body["command"]
            record.container_id = new_container_id
            record.status = "running"
            db.commit()

        return {
            "message": f"Container '{container_name}' redeployed successfully",
            "container_id": new_container_id,
        }
    except Exception as e:
        logger.error("Failed to redeploy container %s: %s", container_name, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/dependents/{container_name}")
def delete_dependent(
    container_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete (remove) a dependent Docker container by name and clean up local data."""
    try:
        all_containers = docker_service.list_all_docker_containers()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    if not any(d["name"] == container_name for d in all_containers):
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        docker_service.remove_container(container_name)

        # Remove from database
        db.query(O11Container).filter(O11Container.name == container_name).delete()
        db.commit()

        # Remove local data directory (data/o11/<name>/)
        import shutil

        o11_data = os.path.join(
            os.path.abspath(settings.DATA_DIR), "o11", container_name
        )
        if os.path.isdir(o11_data):
            shutil.rmtree(o11_data)
            logger.info(
                "Removed data directory for O11 container '%s': %s",
                container_name,
                o11_data,
            )

        return {"message": f"Container {container_name} deleted"}
    except Exception as e:
        logger.error("Failed to delete container %s: %s", container_name, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dependents/{container_name}/{action}")
def control_any_dependent(
    container_name: str,
    action: str,
    current_user: User = Depends(get_current_user),
):
    """Start/stop/restart any Docker container by name."""
    if action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Invalid action")
    # Verify the container exists in our list
    try:
        all_containers = docker_service.list_all_docker_containers()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    if not any(d["name"] == container_name for d in all_containers):
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        if action == "start":
            docker_service.start_container(container_name)
        elif action == "stop":
            docker_service.stop_container(container_name)
        elif action == "restart":
            docker_service.restart_container(container_name)
        return {"message": f"Container {container_name} {action}ed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dependents/{container_name}/inspect")
def inspect_dependent(
    container_name: str,
    current_user: User = Depends(get_current_user),
):
    """Get detailed info about a dependent container by name."""
    try:
        info = docker_service.inspect_container_by_name(container_name)
        if not info:
            raise HTTPException(status_code=404, detail="Container not found")
        return info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dependents/{container_name}/logs")
def get_dependent_logs(
    container_name: str,
    current_user: User = Depends(get_current_user),
):
    """Get logs of a dependent container by name."""
    try:
        logs = docker_service.get_container_logs(container_name)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vpn-info-batch")
def get_vpn_info_batch(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get VPN info for all running containers in one call."""
    containers = db.query(VPNContainer).all()
    targets = [c for c in containers if c.container_id]
    if not targets:
        return {}

    # Phase 1: parallel status check (cheap-ish Docker API call)
    def _status(c):
        try:
            return c, docker_service.get_container_status(c.container_id)
        except Exception:
            return c, None

    running = []
    with ThreadPoolExecutor(max_workers=min(10, len(targets))) as ex:
        for c, info in ex.map(_status, targets):
            if info and info.get("status") in (
                "running",
                "healthy",
                "unhealthy",
                "starting",
            ):
                running.append(c)

    if not running:
        return {}

    # Phase 2: parallel Gluetun HTTP probes — was the slowest step (3 HTTP per container, serial).
    def _vpn_info(c):
        try:
            return str(c.id), docker_service.get_gluetun_vpn_info(c.container_id)
        except Exception:
            return str(c.id), None

    result: dict = {}
    with ThreadPoolExecutor(max_workers=min(10, len(running))) as ex:
        for cid, info in ex.map(_vpn_info, running):
            if info is not None:
                result[cid] = info
    return result


@router.get("/providers/{provider_key}")
def get_provider(provider_key: str):
    provider = get_provider_fields(provider_key)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.get("", response_model=list[ContainerResponse])
def list_containers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    containers = db.query(VPNContainer).all()

    # Pre-fetch Docker statuses in parallel — biggest perf win for this endpoint.
    # Each get_container_status() does a blocking Docker API call (~50-200ms);
    # serial loop = N * latency, parallel = ~max latency.
    status_map: dict[str, dict] = {}
    container_ids = [c.container_id for c in containers if c.container_id]
    if container_ids:
        def _fetch(cid: str):
            try:
                return cid, docker_service.get_container_status(cid)
            except Exception:
                return cid, None
        with ThreadPoolExecutor(max_workers=min(10, len(container_ids))) as ex:
            for cid, info in ex.map(_fetch, container_ids):
                if info is not None:
                    status_map[cid] = info

    result = []
    for c in containers:
        data = ContainerResponse.model_validate(c)
        if c.container_id:
            try:
                status_info = status_map.get(c.container_id)
                if status_info is None:
                    data.status = "unknown"
                else:
                    data.status = status_info["status"]
                    data.docker_name = status_info.get("docker_name")
                    data.ip_address = status_info.get("ip_address")
                    # If container was removed/replaced, try to find it by name/label
                    if status_info["status"] in ("removed", "error"):
                        found = docker_service.find_container_by_name(c.name)
                        if found:
                            old_id = c.container_id
                            c.container_id = found["container_id"]
                            c.status = found["status"]
                            db.commit()
                            data.status = found["status"]
                            data.container_id = found["container_id"]
                            data.docker_name = docker_service.get_container_docker_name(
                                found["container_id"]
                            )
                            # Restart dependents so they reconnect to new container
                            if (
                                found["status"] == "running"
                                and old_id != found["container_id"]
                            ):
                                docker_service.restart_dependents(found["container_id"])
                        else:
                            # Container is truly gone — auto-remove from DB
                            logger.info(
                                "Container '%s' (id=%s) removed from Docker, deleting from DB",
                                c.name,
                                c.id,
                            )
                            db.delete(c)
                            db.commit()
                            continue
            except Exception:
                data.status = "unknown"
        result.append(data)
    return result


@router.post("", response_model=ContainerResponse, status_code=201)
def create_container(
    req: ContainerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(VPNContainer).filter(VPNContainer.name == req.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Container with name '{req.name}' already exists",
        )

    if req.vpn_provider not in VPN_PROVIDERS and req.vpn_provider != "custom":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown VPN provider: {req.vpn_provider}",
        )

    try:
        gluetun_image = _get_gluetun_image(db)
        container_id = docker_service.create_container(
            name=req.name,
            vpn_provider=req.vpn_provider,
            vpn_type=req.vpn_type,
            config=req.config,
            port_http_proxy=req.port_http_proxy,
            port_shadowsocks=req.port_shadowsocks,
            extra_ports=req.extra_ports,
            extra_hosts=req.extra_hosts if req.extra_hosts else None,
            network_name=req.network_name,
            devices=req.devices if req.devices else None,
            hostname=req.hostname if req.hostname else None,
            custom_labels=req.custom_labels if req.custom_labels else None,
            cap_add=req.cap_add if req.cap_add else None,
            gluetun_image=gluetun_image,
            socks5_enabled=req.socks5_enabled,
            port_socks5=req.port_socks5,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Docker container: {e}",
        )

    # Create SOCKS5 sidecar container if enabled
    socks5_container_id = None
    if req.socks5_enabled:
        gluetun_container_name = f"gluetun-{req.name}"
        socks5_container_id = docker_service.create_socks5_sidecar(
            req.name, gluetun_container_name, req.port_socks5
        )

    # Read actual Docker env vars to store the full config (including auto-set vars
    # like VPN_SERVICE_PROVIDER, VPN_TYPE, HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE, etc.)
    full_config = dict(req.config)
    try:
        live_env = docker_service._get_container_env(container_id)
        for k, v in live_env.items():
            if k in docker_service.ALLOWED_CONFIG_KEYS:
                full_config[k] = v
    except Exception:
        pass

    vpn_container = VPNContainer(
        name=req.name,
        vpn_provider=req.vpn_provider,
        vpn_type=req.vpn_type,
        config=full_config,
        port_http_proxy=req.port_http_proxy,
        port_shadowsocks=req.port_shadowsocks,
        socks5_enabled=req.socks5_enabled,
        port_socks5=req.port_socks5,
        socks5_container_id=socks5_container_id,
        extra_ports=req.extra_ports,
        extra_hosts=req.extra_hosts if req.extra_hosts else None,
        network_name=req.network_name,
        devices=req.devices if req.devices else None,
        hostname=req.hostname if req.hostname else None,
        custom_labels=req.custom_labels if req.custom_labels else None,
        cap_add=req.cap_add if req.cap_add else None,
        container_id=container_id,
        status="running",
        created_by=current_user.id,
    )
    db.add(vpn_container)
    db.commit()
    db.refresh(vpn_container)
    return ContainerResponse.model_validate(vpn_container)


@router.get("/{container_id}", response_model=ContainerResponse)
def get_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")
    data = ContainerResponse.model_validate(c)
    if c.container_id:
        try:
            status_info = docker_service.get_container_status(c.container_id)
            data.status = status_info["status"]
            data.docker_name = status_info.get("docker_name")
            data.ip_address = status_info.get("ip_address")
            # If container was removed/replaced, try to find it by name/label
            if status_info["status"] in ("removed", "error"):
                found = docker_service.find_container_by_name(c.name)
                if found:
                    old_id = c.container_id
                    c.container_id = found["container_id"]
                    c.status = found["status"]
                    db.commit()
                    data.status = found["status"]
                    data.container_id = found["container_id"]
                    data.docker_name = docker_service.get_container_docker_name(
                        found["container_id"]
                    )
                    # Restart dependents so they reconnect to new container
                    if found["status"] == "running" and old_id != found["container_id"]:
                        docker_service.restart_dependents(found["container_id"])

            # Sync config from actual Docker env vars into DB
            # This ensures auto-set vars (VPN_SERVICE_PROVIDER, VPN_TYPE, etc.)
            # are persisted and shown for all providers, not just discovered ones
            active_id = c.container_id
            if active_id and data.status not in ("removed", "error"):
                live_env = docker_service._get_container_env(active_id)
                live_config = {
                    k: v
                    for k, v in live_env.items()
                    if k in docker_service.ALLOWED_CONFIG_KEYS
                }
                db_config = dict(c.config or {})
                if live_config != {
                    k: v
                    for k, v in db_config.items()
                    if k in docker_service.ALLOWED_CONFIG_KEYS
                }:
                    merged = {**db_config, **live_config}
                    c.config = merged
                    db.commit()
                    data = ContainerResponse.model_validate(c)
                    data.status = status_info["status"]
                    data.docker_name = status_info.get("docker_name")
                    data.ip_address = status_info.get("ip_address")
        except Exception:
            data.status = "unknown"
    return data


@router.put("/{container_id}", response_model=ContainerResponse)
def update_container(
    container_id: int,
    req: ContainerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Allow clearing string fields by setting them to empty string -> store as None
        if value == "" and field in ("description",):
            value = None
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return ContainerResponse.model_validate(c)


@router.delete("/{container_id}")
def delete_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    if c.container_id:
        try:
            # Stop dependent containers before removing VPN container
            docker_service.stop_dependents(c.container_id)
            # Remove SOCKS5 sidecar if it exists
            if c.socks5_enabled:
                docker_service.remove_socks5_sidecar(c.name)
            docker_service.remove_container(c.container_id)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove Docker container: {e}",
            )

    db.delete(c)
    db.commit()
    return {"message": "Container deleted"}


@router.post("/{container_id}/start")
def start_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        docker_service.start_container(c.container_id)
        c.status = "running"
        db.commit()
        # Start dependent containers after Gluetun is up
        started = docker_service.start_dependents(c.container_id)
        msg = "Container started"
        if started:
            msg += f" (also started: {', '.join(started)})"
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{container_id}/stop")
def stop_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        # Stop dependent containers first before stopping Gluetun
        stopped = docker_service.stop_dependents(c.container_id)
        docker_service.stop_container(c.container_id)
        c.status = "exited"
        db.commit()
        msg = "Container stopped"
        if stopped:
            msg += f" (also stopped: {', '.join(stopped)})"
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{container_id}/restart")
def restart_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        docker_service.restart_container(c.container_id)
        c.status = "running"
        db.commit()
        # Restart dependent containers so they reconnect
        restarted = docker_service.restart_dependents(c.container_id)
        msg = "Container restarted"
        if restarted:
            msg += f" (also restarted: {', '.join(restarted)})"
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{container_id}/redeploy")
def redeploy_container(
    container_id: int,
    req: ContainerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Redeploy a container with updated configuration.
    Stops dependents, removes old container, creates new one, restarts dependents.
    """
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")

    # Check if name is being changed and validate uniqueness
    old_name = c.name
    new_name = req.name
    if new_name and new_name != old_name:
        existing = (
            db.query(VPNContainer)
            .filter(VPNContainer.name == new_name, VPNContainer.id != container_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Container with name '{new_name}' already exists",
            )

    update_data = req.model_dump(exclude_none=True)
    target_name = update_data.get("name", c.name)
    target_vpn_provider = update_data.get("vpn_provider", c.vpn_provider)
    target_vpn_type = update_data.get("vpn_type", c.vpn_type)
    target_config = update_data.get("config", c.config)
    target_port_http_proxy = update_data.get("port_http_proxy", c.port_http_proxy)
    target_port_shadowsocks = update_data.get("port_shadowsocks", c.port_shadowsocks)
    target_extra_ports = update_data.get("extra_ports", c.extra_ports)
    target_extra_hosts = update_data.get("extra_hosts", c.extra_hosts)
    target_network_name = update_data.get("network_name", c.network_name)
    target_devices = update_data.get("devices", c.devices)
    target_hostname = update_data.get("hostname", c.hostname)
    target_custom_labels = update_data.get("custom_labels", c.custom_labels)
    target_cap_add = update_data.get("cap_add", c.cap_add)
    target_socks5_enabled = update_data.get("socks5_enabled", c.socks5_enabled)
    target_port_socks5 = update_data.get("port_socks5", c.port_socks5)

    try:
        gluetun_image = _get_gluetun_image(db)
        new_id = docker_service.redeploy_container(
            name=old_name,
            old_container_id=c.container_id,
            vpn_provider=target_vpn_provider,
            vpn_type=target_vpn_type,
            config=target_config,
            port_http_proxy=target_port_http_proxy,
            port_shadowsocks=target_port_shadowsocks,
            extra_ports=target_extra_ports if target_extra_ports else None,
            extra_hosts=target_extra_hosts if target_extra_hosts else None,
            network_name=target_network_name,
            devices=target_devices if target_devices else None,
            hostname=target_hostname if target_hostname else None,
            custom_labels=target_custom_labels if target_custom_labels else None,
            cap_add=target_cap_add if target_cap_add else None,
            new_name=target_name if target_name and target_name != old_name else None,
            gluetun_image=gluetun_image,
            socks5_enabled=target_socks5_enabled,
            port_socks5=target_port_socks5,
        )
        if not new_id:
            raise HTTPException(
                status_code=500, detail="Redeploy finished without container ID"
            )

        for field, value in update_data.items():
            setattr(c, field, value)
        c.container_id = new_id
        c.status = "running"

        # Create SOCKS5 sidecar if enabled
        deploy_name = (
            target_name if target_name and target_name != old_name else old_name
        )
        if target_socks5_enabled:
            gluetun_container_name = f"gluetun-{deploy_name}"
            socks5_id = docker_service.create_socks5_sidecar(
                deploy_name, gluetun_container_name, target_port_socks5
            )
            c.socks5_container_id = socks5_id
        else:
            c.socks5_container_id = None

        # Sync config from new Docker container env vars
        try:
            live_env = docker_service._get_container_env(new_id)
            merged = dict(c.config or {})
            for k, v in live_env.items():
                if k in docker_service.ALLOWED_CONFIG_KEYS:
                    merged[k] = v
            c.config = merged
        except Exception:
            pass
        db.commit()
        return {"message": "Container redeployed successfully", "container_id": new_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to redeploy container: {e}"
        )


@router.get("/{container_id}/logs", response_model=ContainerLogsResponse)
def get_logs(
    container_id: int,
    tail: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        logs = docker_service.get_container_logs(c.container_id, tail=tail)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    return {"logs": logs}


@router.get("/{container_id}/status", response_model=ContainerStatusResponse)
def get_status(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        return docker_service.get_container_status(c.container_id)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/{container_id}/vpn-info")
def get_vpn_info(
    container_id: int,
    debug: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        return docker_service.get_gluetun_vpn_info(c.container_id, debug=debug)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.get("/{container_id}/debug-mount")
def debug_mount(
    container_id: int,
    db: Session = Depends(get_db),
):
    """Debug endpoint: show mount paths and file listing for a container's gluetun data dir."""
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", c.name)
    if settings.HOST_DATA_DIR:
        gluetun_mount = os.path.join(settings.HOST_DATA_DIR, "gluetun", c.name)
    else:
        gluetun_mount = gluetun_data

    files = []
    try:
        files = os.listdir(gluetun_data)
    except Exception as e:
        files = [f"ERROR: {e}"]

    # Inspect running container's actual mounts
    actual_mounts = []
    if c.container_id:
        try:
            client = docker_service._get_client()
            container = client.containers.get(c.container_id)
            for m in container.attrs.get("Mounts", []):
                actual_mounts.append(
                    {
                        "source": m.get("Source"),
                        "destination": m.get("Destination"),
                        "mode": m.get("Mode"),
                    }
                )
        except Exception as e:
            actual_mounts = [{"error": str(e)}]

    # Inspect running container's env vars related to cert files
    cert_env_vars = {}
    if c.container_id:
        try:
            env = docker_service._get_container_env(c.container_id)
            for k, v in env.items():
                if "CERT" in k or "KEY" in k or "SECRET" in k:
                    cert_env_vars[k] = v
        except Exception:
            pass

    return {
        "name": c.name,
        "HOST_DATA_DIR": settings.HOST_DATA_DIR or "(not set)",
        "DATA_DIR": os.path.abspath(settings.DATA_DIR),
        "gluetun_data_path": gluetun_data,
        "gluetun_mount_path": gluetun_mount,
        "files_in_data_dir": files,
        "actual_container_mounts": actual_mounts,
        "cert_env_vars": cert_env_vars,
        "db_config": {
            k: v
            for k, v in (c.config or {}).items()
            if "CERT" in k or "KEY" in k or "SECRET" in k
        },
    }


@router.get("/{container_id}/compose", response_class=PlainTextResponse)
def export_compose(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")
    gluetun_image = _get_gluetun_image(db)
    try:
        yaml_content = docker_service.generate_compose_yaml(
            name=c.name,
            vpn_provider=c.vpn_provider,
            vpn_type=c.vpn_type,
            config=c.config,
            port_http_proxy=c.port_http_proxy,
            port_shadowsocks=c.port_shadowsocks,
            extra_ports=c.extra_ports if c.extra_ports else None,
            extra_hosts=c.extra_hosts if c.extra_hosts else None,
            network_name=c.network_name,
            gluetun_image=gluetun_image,
            socks5_enabled=c.socks5_enabled,
            port_socks5=c.port_socks5,
        )
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    return yaml_content


@router.get("/{container_id}/dependents")
def get_dependents(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    try:
        return docker_service.get_dependent_containers(c.container_id)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")


@router.post("/{container_id}/dependents/{docker_name}/{action}")
def control_dependent(
    container_id: int,
    docker_name: str,
    action: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Invalid action")
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c or not c.container_id:
        raise HTTPException(status_code=404, detail="Container not found")
    # Verify the target is actually a dependent of this container
    try:
        dependents = docker_service.get_dependent_containers(c.container_id)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Docker is not available")
    if not any(d["name"] == docker_name for d in dependents):
        raise HTTPException(
            status_code=403, detail="Container is not a dependent of this VPN container"
        )
    try:
        if action == "start":
            docker_service.start_container(docker_name)
        elif action == "stop":
            docker_service.stop_container(docker_name)
        elif action == "restart":
            docker_service.restart_container(docker_name)
        return {"message": f"Container {docker_name} {action}ed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


ALLOWED_CONFIG_EXTENSIONS = {
    ".ovpn",
    ".conf",
    ".key",
    ".crt",
    ".pem",
    ".txt",
    ".cfg",
    ".json",
}
MAX_CONFIG_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/{container_id}/upload-config")
async def upload_vpn_config(
    container_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a VPN config file to the container's gluetun data directory."""
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    # Validate filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    filename = os.path.basename(file.filename)
    _, ext = os.path.splitext(filename)
    if ext and ext.lower() not in ALLOWED_CONFIG_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_CONFIG_EXTENSIONS))}, or no extension",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_CONFIG_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 100 MB)")

    # Save to data/gluetun/{name}/
    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", c.name)
    os.makedirs(gluetun_data, exist_ok=True)
    dest = os.path.join(gluetun_data, filename)
    with open(dest, "wb") as f:
        f.write(content)

    logger.info("Uploaded config file '%s' for container '%s'", filename, c.name)
    return {
        "message": f"Uploaded {filename}",
        "filename": filename,
        "path": f"/gluetun/{filename}",
    }


@router.get("/{container_id}/config-files")
def list_config_files(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List VPN config files in the container's gluetun data directory."""
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", c.name)
    if not os.path.isdir(gluetun_data):
        return []

    files = []
    for fname in os.listdir(gluetun_data):
        fpath = os.path.join(gluetun_data, fname)
        if os.path.isfile(fpath):
            _, ext = os.path.splitext(fname)
            if not ext or ext.lower() in ALLOWED_CONFIG_EXTENSIONS:
                files.append(
                    {
                        "name": fname,
                        "size": os.path.getsize(fpath),
                        "path": f"/gluetun/{fname}",
                    }
                )
    return files


@router.delete("/{container_id}/config-files/{filename}")
def delete_config_file(
    container_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a VPN config file from the container's gluetun data directory."""
    c = db.query(VPNContainer).filter(VPNContainer.id == container_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")

    # Prevent path traversal
    safe_name = os.path.basename(filename)
    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", c.name)
    fpath = os.path.join(gluetun_data, safe_name)

    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(fpath)
    logger.info("Deleted config file '%s' for container '%s'", safe_name, c.name)
    return {"message": f"Deleted {safe_name}"}


@router.post("/upload-config-by-name/{name}")
async def upload_vpn_config_by_name(
    name: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a VPN config file by container name (for pre-creation uploads)."""
    # Validate name
    import re

    if not re.match(r"^[a-z0-9_-]+$", name):
        raise HTTPException(status_code=400, detail="Invalid container name")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    filename = os.path.basename(file.filename)
    _, ext = os.path.splitext(filename)
    if ext and ext.lower() not in ALLOWED_CONFIG_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_CONFIG_EXTENSIONS))}, or no extension",
        )

    content = await file.read()
    if len(content) > MAX_CONFIG_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 100 MB)")

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    os.makedirs(gluetun_data, exist_ok=True)
    dest = os.path.join(gluetun_data, filename)
    with open(dest, "wb") as f:
        f.write(content)

    logger.info(
        "Uploaded config file '%s' for name '%s' (pre-creation)", filename, name
    )
    return {
        "message": f"Uploaded {filename}",
        "filename": filename,
        "path": f"/gluetun/{filename}",
    }
