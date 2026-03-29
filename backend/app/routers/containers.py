import logging
import os
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.vpn_container import VPNContainer
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
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/containers", tags=["containers"])


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
    discovered = docker_service.discover_gluetun_containers()
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
    return docker_service.list_docker_networks()


@router.get("/stacks")
def list_stacks(
    current_user: User = Depends(get_current_user),
):
    """List available Docker Compose stacks."""
    return docker_service.list_docker_stacks()


@router.get("/dependents")
def list_all_dependents(
    current_user: User = Depends(get_current_user),
):
    """List all Docker containers (non-Gluetun) with VPN connection info."""
    return docker_service.list_all_docker_containers()


@router.get("/dependents/debug")
def debug_dependents():
    """Debug endpoint: show VPN detection details for all containers. No auth required."""
    return docker_service.list_all_docker_containers_debug()


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
    all_containers = docker_service.list_all_docker_containers()
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
    result = {}
    for c in containers:
        if c.container_id:
            try:
                status_info = docker_service.get_container_status(c.container_id)
                if status_info["status"] in (
                    "running",
                    "healthy",
                    "unhealthy",
                    "starting",
                ):
                    result[str(c.id)] = docker_service.get_gluetun_vpn_info(
                        c.container_id
                    )
            except Exception:
                pass
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
    result = []
    for c in containers:
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
        container_id = docker_service.create_container(
            name=req.name,
            vpn_provider=req.vpn_provider,
            vpn_type=req.vpn_type,
            config=req.config,
            port_http_proxy=req.port_http_proxy,
            port_shadowsocks=req.port_shadowsocks,
            extra_ports=req.extra_ports,
            network_name=req.network_name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Docker container: {e}",
        )

    vpn_container = VPNContainer(
        name=req.name,
        vpn_provider=req.vpn_provider,
        vpn_type=req.vpn_type,
        config=req.config,
        port_http_proxy=req.port_http_proxy,
        port_shadowsocks=req.port_shadowsocks,
        extra_ports=req.extra_ports,
        network_name=req.network_name,
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

    # Apply updates from request to DB record
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)

    try:
        new_id = docker_service.redeploy_container(
            name=c.name,
            old_container_id=c.container_id,
            vpn_provider=c.vpn_provider,
            vpn_type=c.vpn_type,
            config=c.config,
            port_http_proxy=c.port_http_proxy,
            port_shadowsocks=c.port_shadowsocks,
            extra_ports=c.extra_ports if c.extra_ports else None,
            network_name=c.network_name,
        )
        c.container_id = new_id
        c.status = "running"
        db.commit()
        return {"message": "Container redeployed successfully", "container_id": new_id}
    except Exception as e:
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
    logs = docker_service.get_container_logs(c.container_id, tail=tail)
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
    return docker_service.get_container_status(c.container_id)


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
    return docker_service.get_gluetun_vpn_info(c.container_id, debug=debug)


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
    yaml_content = docker_service.generate_compose_yaml(
        name=c.name,
        vpn_provider=c.vpn_provider,
        vpn_type=c.vpn_type,
        config=c.config,
        port_http_proxy=c.port_http_proxy,
        port_shadowsocks=c.port_shadowsocks,
        extra_ports=c.extra_ports if c.extra_ports else None,
        network_name=c.network_name,
    )
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
    return docker_service.get_dependent_containers(c.container_id)


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
    dependents = docker_service.get_dependent_containers(c.container_id)
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
