import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.app_settings import AppSettings
from app.utils.security import get_current_user
from app.services import monitoring_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/status")
def monitoring_status(current_user: User = Depends(get_current_user)):
    """Check if O11 monitoring is configured."""
    return {"configured": monitoring_service.is_configured()}


@router.get("")
def get_monitoring(current_user: User = Depends(get_current_user)):
    """Fetch overall monitoring data from O11 panel."""
    if not monitoring_service.is_configured():
        raise HTTPException(status_code=503, detail="O11 monitoring not configured")
    try:
        return monitoring_service.get_monitoring()
    except Exception as e:
        logger.error("Monitoring fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/network-usage")
def get_network_usage(
    provider: str = Query(..., description="Provider ID / slug"),
    current_user: User = Depends(get_current_user),
):
    """Fetch network-usage proxy data from O11 panel for a provider."""
    if not monitoring_service.is_configured():
        raise HTTPException(status_code=503, detail="O11 monitoring not configured")
    try:
        return monitoring_service.get_network_usage(provider)
    except Exception as e:
        logger.error("Network-usage fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/proxy-count")
def get_proxy_count(
    provider: str = Query(..., description="Provider ID / slug"),
    current_user: User = Depends(get_current_user),
):
    """Return the total number of active proxy URLs for a provider."""
    if not monitoring_service.is_configured():
        raise HTTPException(status_code=503, detail="O11 monitoring not configured")
    try:
        count = monitoring_service.get_proxy_count(provider)
        return {"count": count}
    except Exception as e:
        logger.error("Proxy count fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


def _get_instance(db: Session, instance_id: str) -> dict:
    """Resolve an O11 instance by ID from the DB."""
    row = db.query(AppSettings).filter(AppSettings.key == "o11_instances").first()
    if not row or not row.value:
        raise HTTPException(status_code=404, detail="No O11 instances configured")
    try:
        instances = json.loads(row.value)
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupt O11 instances data")
    inst = next((i for i in instances if i.get("id") == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    if not (inst.get("url") and inst.get("username") and inst.get("password")):
        raise HTTPException(status_code=503, detail="Instance not fully configured")
    return inst


@router.get("/instance/{instance_id}")
def get_instance_monitoring(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch monitoring data for a specific O11 instance."""
    inst = _get_instance(db, instance_id)
    try:
        return monitoring_service.get_monitoring_for_instance(
            instance_id,
            inst["url"],
            inst["username"],
            inst["password"],
        )
    except Exception as e:
        logger.error("Instance monitoring fetch failed (%s): %s", instance_id, e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instance/{instance_id}/network-usage")
def get_instance_network_usage(
    instance_id: str,
    provider: str = Query(..., description="Provider ID / slug"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch network-usage for a specific O11 instance."""
    inst = _get_instance(db, instance_id)
    try:
        return monitoring_service.get_network_usage_for_instance(
            instance_id,
            inst["url"],
            inst["username"],
            inst["password"],
            provider,
        )
    except Exception as e:
        logger.error("Instance network-usage fetch failed (%s): %s", instance_id, e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/instance/{instance_id}/proxy-count")
def get_instance_proxy_count(
    instance_id: str,
    provider: str = Query(..., description="Provider ID / slug"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return active proxy URL count for a specific O11 instance."""
    inst = _get_instance(db, instance_id)
    try:
        count = monitoring_service.get_proxy_count_for_instance(
            instance_id,
            inst["url"],
            inst["username"],
            inst["password"],
            provider,
        )
        return {"count": count}
    except Exception as e:
        logger.error("Instance proxy count fetch failed (%s): %s", instance_id, e)
        raise HTTPException(status_code=502, detail=str(e))
