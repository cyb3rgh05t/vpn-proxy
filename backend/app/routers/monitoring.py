import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.models.user import User
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
