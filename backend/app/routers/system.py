import logging
import platform
from fastapi import APIRouter, Depends
from app.models.user import User
from app.utils.security import get_current_user

try:
    import docker
except ImportError:
    docker = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/docker-status")
def docker_status(current_user: User = Depends(get_current_user)):
    """Test Docker socket connection and return system info."""
    result = {
        "connected": False,
        "socket": None,
        "server_version": None,
        "api_version": None,
        "os": None,
        "arch": None,
        "containers_running": None,
        "containers_total": None,
        "images": None,
        "error": None,
    }

    if docker is None:
        result["error"] = "Docker SDK not installed"
        return result

    try:
        client = docker.from_env()
        info = client.info()
        version = client.version()

        result["connected"] = True
        result["socket"] = client.api.base_url
        result["server_version"] = version.get("Version")
        result["api_version"] = version.get("ApiVersion")
        result["os"] = info.get("OperatingSystem", platform.system())
        result["arch"] = info.get("Architecture", platform.machine())
        result["containers_running"] = info.get("ContainersRunning", 0)
        result["containers_total"] = info.get("Containers", 0)
        result["images"] = info.get("Images", 0)
    except Exception as e:
        logger.error("Docker connection test failed: %s", e)
        result["error"] = str(e)

    return result
