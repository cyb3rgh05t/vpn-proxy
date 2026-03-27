from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
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
from app.services.providers import VPN_PROVIDERS, get_provider_list, get_provider_fields
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/containers", tags=["containers"])


@router.get("/providers")
def list_providers():
    return get_provider_list()


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
            port_control=req.port_control,
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
        port_control=req.port_control,
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

    for field, value in req.model_dump(exclude_none=True).items():
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
        return {"message": "Container started"}
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
        docker_service.stop_container(c.container_id)
        c.status = "exited"
        db.commit()
        return {"message": "Container stopped"}
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
        return {"message": "Container restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        port_control=c.port_control,
    )
    return yaml_content
