import logging
import os
import docker
from docker.types import RestartPolicy  # noqa
import yaml
from docker.errors import NotFound, APIError
from app.config import settings

logger = logging.getLogger(__name__)

CONTAINER_LABEL = "managed-by"
CONTAINER_LABEL_VALUE = "vpn-proxy"


def _get_client():
    try:
        return docker.from_env()
    except Exception as e:
        logger.error("Failed to connect to Docker daemon: %s", e)
        raise RuntimeError(
            "Cannot connect to Docker. Ensure the Docker socket is accessible."
        ) from e


def pull_gluetun_image():
    client = _get_client()
    try:
        client.images.pull(settings.GLUETUN_IMAGE)
        return True
    except Exception as e:
        logger.error("Failed to pull Gluetun image: %s", e)
        return False


def create_container(
    name: str,
    vpn_provider: str,
    vpn_type: str,
    config: dict,
    port_http_proxy: int = 8888,
    port_shadowsocks: int = 8388,
    port_control: int = 8000,
):
    client = _get_client()
    container_name = f"gluetun-{name}"

    env_vars = {
        "VPN_SERVICE_PROVIDER": vpn_provider,
        "VPN_TYPE": vpn_type,
    }
    for key, value in config.items():
        if value:
            env_vars[key] = str(value)

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    os.makedirs(gluetun_data, exist_ok=True)

    ports = {
        "8888/tcp": port_http_proxy,
        "8388/tcp": port_shadowsocks,
        "8388/udp": port_shadowsocks,
        "8000/tcp": port_control,
    }

    try:
        container = client.containers.run(
            image=settings.GLUETUN_IMAGE,
            name=container_name,
            cap_add=["NET_ADMIN"],
            devices=["/dev/net/tun:/dev/net/tun"],
            environment=env_vars,
            ports=ports,
            volumes={gluetun_data: {"bind": "/gluetun", "mode": "rw"}},
            detach=True,
            restart_policy={"Name": "unless-stopped", "MaximumRetryCount": 0},  # type: ignore[arg-type]
            labels={CONTAINER_LABEL: CONTAINER_LABEL_VALUE, "vpn-proxy-name": name},
        )
        return container.id  # type: ignore[union-attr]
    except APIError as e:
        logger.error("Failed to create container %s: %s", container_name, e)
        raise


def start_container(container_id: str):
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.start()
        return True
    except (NotFound, APIError) as e:
        logger.error("Failed to start container %s: %s", container_id, e)
        raise


def stop_container(container_id: str):
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.stop(timeout=10)
        return True
    except (NotFound, APIError) as e:
        logger.error("Failed to stop container %s: %s", container_id, e)
        raise


def restart_container(container_id: str):
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.restart(timeout=10)
        return True
    except (NotFound, APIError) as e:
        logger.error("Failed to restart container %s: %s", container_id, e)
        raise


def remove_container(container_id: str):
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.remove(force=True)
        return True
    except NotFound:
        return True
    except APIError as e:
        logger.error("Failed to remove container %s: %s", container_id, e)
        raise


def get_container_status(container_id: str) -> dict:
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        info = {"status": container.status, "container_id": container.short_id}
        try:
            networks = container.attrs.get("NetworkSettings", {}).get("Networks", {})
            for net in networks.values():
                if net.get("IPAddress"):
                    info["ip_address"] = net["IPAddress"]
                    break
        except Exception:
            pass
        return info
    except NotFound:
        return {"status": "removed", "container_id": None}
    except APIError as e:
        logger.error("Failed to get status for %s: %s", container_id, e)
        return {"status": "error", "container_id": container_id}


def get_container_logs(container_id: str, tail: int = 200) -> str:
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        return container.logs(tail=tail, timestamps=True).decode(
            "utf-8", errors="replace"
        )
    except NotFound:
        return "Container not found."
    except APIError as e:
        logger.error("Failed to get logs for %s: %s", container_id, e)
        return f"Error fetching logs: {e}"


def generate_compose_yaml(
    name: str,
    vpn_provider: str,
    vpn_type: str,
    config: dict,
    port_http_proxy: int = 8888,
    port_shadowsocks: int = 8388,
    port_control: int = 8000,
) -> str:
    container_name = f"gluetun-{name}"
    env_vars = {
        "VPN_SERVICE_PROVIDER": vpn_provider,
        "VPN_TYPE": vpn_type,
    }
    for key, value in config.items():
        if value:
            env_vars[key] = str(value)

    compose = {
        "services": {
            container_name: {
                "image": settings.GLUETUN_IMAGE,
                "container_name": container_name,
                "cap_add": ["NET_ADMIN"],
                "devices": ["/dev/net/tun:/dev/net/tun"],
                "environment": env_vars,
                "ports": [
                    f"{port_http_proxy}:8888",
                    f"{port_shadowsocks}:8388/tcp",
                    f"{port_shadowsocks}:8388/udp",
                    f"{port_control}:8000",
                ],
                "volumes": [f"./gluetun/{name}:/gluetun"],
                "restart": "unless-stopped",
            }
        }
    }
    return yaml.dump(compose, default_flow_style=False, sort_keys=False)
