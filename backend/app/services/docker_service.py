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
    port_control: int = 8001,
    extra_ports: list[dict] | None = None,
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

    # Add extra port mappings
    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                ports[f"{container_port}/{protocol}"] = host

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


def find_container_by_name(name: str) -> dict | None:
    """Try to find a Docker container by name (tries 'gluetun-{name}' and '{name}')."""
    client = _get_client()
    for candidate in [f"gluetun-{name}", name]:
        try:
            container = client.containers.get(candidate)
            return {
                "container_id": container.id,
                "status": container.status,
            }
        except (NotFound, APIError):
            continue
    return None


def restart_dependents(container_id: str) -> list[str]:
    """Restart all containers using this container's network. Returns list of restarted names."""
    dependents = get_dependent_containers(container_id)
    restarted = []
    client = _get_client()
    for dep in dependents:
        try:
            c = client.containers.get(dep["name"])
            c.restart(timeout=10)
            restarted.append(dep["name"])
        except Exception as e:
            logger.warning("Failed to restart dependent %s: %s", dep["name"], e)
    return restarted


def stop_dependents(container_id: str) -> list[str]:
    """Stop all containers using this container's network. Returns list of stopped names."""
    dependents = get_dependent_containers(container_id)
    stopped = []
    client = _get_client()
    for dep in dependents:
        if dep["status"] != "running":
            continue
        try:
            c = client.containers.get(dep["name"])
            c.stop(timeout=10)
            stopped.append(dep["name"])
        except Exception as e:
            logger.warning("Failed to stop dependent %s: %s", dep["name"], e)
    return stopped


def start_dependents(container_id: str) -> list[str]:
    """Start all stopped containers using this container's network. Returns list of started names."""
    dependents = get_dependent_containers(container_id)
    started = []
    client = _get_client()
    for dep in dependents:
        if dep["status"] == "running":
            continue
        try:
            c = client.containers.get(dep["name"])
            c.start()
            started.append(dep["name"])
        except Exception as e:
            logger.warning("Failed to start dependent %s: %s", dep["name"], e)
    return started


def get_dependent_containers(container_id: str) -> list[dict]:
    """Find all containers using this container's network (network_mode: container:<id>)."""
    client = _get_client()
    dependents = []
    try:
        target = client.containers.get(container_id)
        target_name = target.name or ""
        target_id = target.id or ""

        for c in client.containers.list(all=True):
            try:
                network_mode = c.attrs.get("HostConfig", {}).get("NetworkMode", "")
                # network_mode can be "container:<name>" or "container:<id>"
                if network_mode.startswith("container:"):
                    ref = network_mode.split(":", 1)[1]
                    if (
                        ref == target_name
                        or ref == target_id
                        or target_id.startswith(ref)
                    ):
                        image_tags = c.image.tags if c.image else []
                        dependents.append(
                            {
                                "name": c.name,
                                "id": c.short_id,
                                "status": c.status,
                                "image": (
                                    image_tags[0]
                                    if image_tags
                                    else c.attrs.get("Config", {}).get(
                                        "Image", "unknown"
                                    )
                                ),
                            }
                        )
            except Exception:
                continue
    except NotFound:
        return []
    except APIError as e:
        logger.error("Failed to get dependent containers for %s: %s", container_id, e)
        return []
    return dependents


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
    port_control: int = 8001,
    extra_ports: list[dict] | None = None,
) -> str:
    container_name = f"gluetun-{name}"
    env_vars = {
        "VPN_SERVICE_PROVIDER": vpn_provider,
        "VPN_TYPE": vpn_type,
    }
    for key, value in config.items():
        if value:
            env_vars[key] = str(value)

    port_list = [
        f"{port_http_proxy}:8888",
        f"{port_shadowsocks}:8388/tcp",
        f"{port_shadowsocks}:8388/udp",
        f"{port_control}:8000",
    ]
    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                port_list.append(f"{host}:{container_port}/{protocol}")

    compose = {
        "services": {
            container_name: {
                "image": settings.GLUETUN_IMAGE,
                "container_name": container_name,
                "cap_add": ["NET_ADMIN"],
                "devices": ["/dev/net/tun:/dev/net/tun"],
                "environment": env_vars,
                "ports": port_list,
                "volumes": [f"./gluetun/{name}:/gluetun"],
                "restart": "unless-stopped",
            }
        }
    }
    return yaml.dump(compose, default_flow_style=False, sort_keys=False)


def discover_gluetun_containers() -> list[dict]:
    """Find all existing Gluetun containers in Docker, regardless of who created them."""
    client = _get_client()
    discovered = []
    try:
        all_containers = client.containers.list(all=True)
        for container in all_containers:
            image_tags = container.image.tags if container.image else []
            image_name = ""
            for tag in image_tags:
                if "gluetun" in tag.lower():
                    image_name = tag
                    break
            if not image_name:
                image_id = container.attrs.get("Config", {}).get("Image", "")
                if "gluetun" not in image_id.lower():
                    continue
                image_name = image_id

            attrs = container.attrs or {}
            config = attrs.get("Config", {})
            host_config = attrs.get("HostConfig", {})
            name = container.name or ""

            # Strip "gluetun-" prefix for the display name if present
            display_name = name
            if display_name.startswith("gluetun-"):
                display_name = display_name[8:]
            if display_name.startswith("/"):
                display_name = display_name[1:]

            # Extract environment variables
            env_vars = {}
            for e in config.get("Env", []):
                if "=" in e:
                    k, v = e.split("=", 1)
                    env_vars[k] = v

            vpn_provider = env_vars.get("VPN_SERVICE_PROVIDER", "unknown")
            vpn_type = env_vars.get("VPN_TYPE", "openvpn")

            # Extract port mappings
            port_bindings = host_config.get("PortBindings", {}) or {}
            port_http_proxy = 8888
            port_shadowsocks = 8388
            port_control = 8001

            for port_key, bindings in port_bindings.items():
                if not bindings:
                    continue
                host_port = int(bindings[0].get("HostPort", 0))
                if host_port == 0:
                    continue
                if port_key == "8888/tcp":
                    port_http_proxy = host_port
                elif port_key == "8388/tcp":
                    port_shadowsocks = host_port
                elif port_key == "8000/tcp":
                    port_control = host_port

            # Build config dict from VPN-related env vars (exclude standard ones)
            skip_keys = {"VPN_SERVICE_PROVIDER", "VPN_TYPE", "PATH", "HOME", "HOSTNAME"}
            vpn_config = {}
            for k, v in env_vars.items():
                if (
                    k not in skip_keys
                    and not k.startswith("GO")
                    and not k.startswith("TZ")
                ):
                    vpn_config[k] = v

            discovered.append(
                {
                    "name": display_name,
                    "container_name": name,
                    "container_id": container.id,
                    "vpn_provider": vpn_provider,
                    "vpn_type": vpn_type,
                    "config": vpn_config,
                    "port_http_proxy": port_http_proxy,
                    "port_shadowsocks": port_shadowsocks,
                    "port_control": port_control,
                    "status": container.status,
                }
            )
    except Exception as e:
        logger.error("Failed to discover Gluetun containers: %s", e)
    return discovered
