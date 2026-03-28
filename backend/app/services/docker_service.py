import json
import logging
import os
import secrets
import socket
from typing import Any
import docker
import requests as http_requests
from docker.types import RestartPolicy  # noqa
import yaml
from docker.errors import NotFound, APIError
from app.config import settings

logger = logging.getLogger(__name__)

CONTAINER_LABEL = "managed-by"
CONTAINER_LABEL_VALUE = "vpn-proxy"

# Whitelist of env vars to show in the UI config section
ALLOWED_CONFIG_KEYS = {
    "PGID",
    "PUID",
    "TZ",
    "VERSION_INFORMATION",
    "LOG_LEVEL",
    "VPN_SERVICE_PROVIDER",
    "VPN_TYPE",
    "SERVER_COUNTRIES",
    "SERVER_REGIONS",
    "SERVER_CITIES",
    "WIREGUARD_PRIVATE_KEY",
    "WIREGUARD_ADDRESSES",
    "OPENVPN_USER",
    "OPENVPN_PASSWORD",
    "OPENVPN_USER_SECRETFILE",
    "OPENVPN_PASSWORD_SECRETFILE",
    "OPENVPN_AUTH",
    "OPENVPN_PROCESS_USER",
    "OPENVPN_CERT",
    "OPENVPN_KEY",
    "OPENVPN_CLIENTCRT_SECRETFILE",
    "OPENVPN_CLIENTKEY_SECRETFILE",
    "OPENVPN_ENCRYPTED_KEY",
    "OPENVPN_ENCRYPTED_KEY_SECRETFILE",
    "VPN_PORT_FORWARDING_USERNAME",
    "VPN_PORT_FORWARDING_PASSWORD",
    "OPENVPN_KEY_PASSPHRASE",
    "OPENVPN_KEY_PASSPHRASE_SECRETFILE",
    "DOT_EXCLUDE_IPS",
    "FIREWALL_OUTBOUND_SUBNETS",
    "PUBLICIP_ENABLED",
    "PUBLICIP_API",
    "PUBLICIP_API_TOKEN",
    "HTTPPROXY",
    "HTTPPROXY_LOG",
    "HTTPPROXY_LISTENING_ADDRESS",
    "HTTPPROXY_STEALTH",
    "HTTPPROXY_USER",
    "HTTPPROXY_PASSWORD",
    "HTTPPROXY_USER_SECRETFILE",
    "HTTPPROXY_PASSWORD_SECRETFILE",
    "SHADOWSOCKS",
    "SHADOWSOCKS_ADDRESS",
    "SHADOWSOCKS_PASSWORD",
    "SHADOWSOCKS_PASSWORD_SECRETFILE",
    "HTTP_CONTROL_SERVER_LOG",
    "HTTP_CONTROL_SERVER_ADDRESS",
    "HTTP_CONTROL_SERVER_AUTH_CONFIG_FILEPATH",
    "HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE",
    "UPDATER_PROTONVPN_EMAIL",
    "UPDATER_PROTONVPN_PASSWORD",
    "UPDATER_PERIOD",
    "UPDATER_MIN_RATIO",
    "UPDATER_VPN_SERVICE_PROVIDERS",
}


def filter_config(config: dict) -> dict:
    """Filter config dict to only include whitelisted env var keys."""
    return {k: v for k, v in config.items() if k in ALLOWED_CONFIG_KEYS}


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
    extra_ports: list[dict] | None = None,
    network_name: str | None = None,
):
    client = _get_client()
    container_name = f"gluetun-{name}"

    # Generate a random API key for secure control server access
    api_key = secrets.token_urlsafe(32)
    env_vars = {
        "VPN_SERVICE_PROVIDER": vpn_provider,
        "VPN_TYPE": vpn_type,
        "HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE": json.dumps(
            {"auth": "apikey", "apikey": api_key}
        ),
    }
    for key, value in config.items():
        if value:
            env_vars[key] = str(value)

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    os.makedirs(gluetun_data, exist_ok=True)

    # Build port mappings - only expose services that are enabled
    ports = {}
    httpproxy_enabled = str(config.get("HTTPPROXY", "off")).lower() == "on"
    shadowsocks_enabled = str(config.get("SHADOWSOCKS", "off")).lower() == "on"

    if httpproxy_enabled and port_http_proxy > 0:
        ports["8888/tcp"] = port_http_proxy
    if shadowsocks_enabled and port_shadowsocks > 0:
        ports["8388/tcp"] = port_shadowsocks
        ports["8388/udp"] = port_shadowsocks
    # Control port 8000 is NOT exposed - accessed internally only

    # Add extra port mappings
    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                ports[f"{container_port}/{protocol}"] = host

    try:
        run_kwargs: dict[str, Any] = {
            "image": settings.GLUETUN_IMAGE,
            "name": container_name,
            "cap_add": ["NET_ADMIN"],
            "devices": ["/dev/net/tun:/dev/net/tun"],
            "environment": env_vars,
            "ports": ports,
            "volumes": {gluetun_data: {"bind": "/gluetun", "mode": "rw"}},
            "detach": True,
            "restart_policy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
            "labels": {CONTAINER_LABEL: CONTAINER_LABEL_VALUE, "vpn-proxy-name": name},
        }
        if network_name:
            run_kwargs["network"] = network_name
        container = client.containers.run(**run_kwargs)
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


def redeploy_container(
    name: str,
    old_container_id: str,
    vpn_provider: str,
    vpn_type: str,
    config: dict,
    port_http_proxy: int = 8888,
    port_shadowsocks: int = 8388,
    extra_ports: list[dict] | None = None,
    network_name: str | None = None,
) -> str:
    """Redeploy a Gluetun container with updated config.
    Stops dependents, removes old container, creates new one with same name, restarts dependents.
    Returns new container_id.
    """
    # 1. Stop dependent containers
    stopped_deps = stop_dependents(old_container_id)
    logger.info("Stopped %d dependents before redeploy of %s", len(stopped_deps), name)

    # 2. Remove old container
    remove_container(old_container_id)
    logger.info("Removed old container %s for redeploy", old_container_id[:12])

    # 3. Create new container with same name but updated config
    new_id = create_container(
        name=name,
        vpn_provider=vpn_provider,
        vpn_type=vpn_type,
        config=config,
        port_http_proxy=port_http_proxy,
        port_shadowsocks=port_shadowsocks,
        extra_ports=extra_ports,
        network_name=network_name,
    )
    logger.info("Created new container %s for %s", new_id[:12], name)

    # 4. Restart dependent containers (they reference by name, so they reconnect)
    if stopped_deps:
        started = start_dependents(new_id)
        logger.info("Restarted %d dependents after redeploy", len(started))

    return new_id


def get_container_status(container_id: str) -> dict:
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        docker_name = (container.name or "").lstrip("/")
        docker_status = container.status

        # Check health status if available (running + healthcheck configured)
        health = container.attrs.get("State", {}).get("Health", {})
        health_status = health.get("Status")  # healthy, unhealthy, starting, none
        if docker_status == "running" and health_status in (
            "healthy",
            "unhealthy",
            "starting",
        ):
            docker_status = health_status

        info = {
            "status": docker_status,
            "container_id": container.short_id,
            "docker_name": docker_name,
        }
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
        return {"status": "removed", "container_id": None, "docker_name": None}
    except APIError as e:
        logger.error("Failed to get status for %s: %s", container_id, e)
        return {"status": "error", "container_id": container_id, "docker_name": None}


def _get_container_ip(container_id: str) -> str | None:
    """Get the internal IP address of a container."""
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        networks = container.attrs.get("NetworkSettings", {}).get("Networks", {})
        for net in networks.values():
            ip = net.get("IPAddress")
            if ip:
                return ip
    except Exception:
        pass
    return None


def _get_container_env(container_id: str) -> dict:
    """Extract environment variables from a container."""
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        env_list = container.attrs.get("Config", {}).get("Env", [])
        env_vars = {}
        for e in env_list:
            if "=" in e:
                k, v = e.split("=", 1)
                env_vars[k] = v
        return env_vars
    except Exception:
        return {}


def _get_gluetun_auth(container_id: str) -> dict[str, Any] | None:
    """Get Gluetun HTTP control server auth info from container env vars.
    Returns dict with 'type' key:
        - {"type": "apikey", "apikey": "..."}
        - {"type": "basic", "username": "...", "password": "..."}
        - {"type": "none"} (auth explicitly disabled)
        - None if no auth info found (will likely get 401)
    """
    env = _get_container_env(container_id)
    # 1. Explicit username/password env vars
    user = env.get("HTTP_CONTROL_SERVER_USERNAME", "")
    password = env.get("HTTP_CONTROL_SERVER_PASSWORD", "")
    if user or password:
        return {"type": "basic", "username": user, "password": password}
    # 2. Parse HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE JSON (Gluetun v3.39.1+)
    default_role = env.get("HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE", "")
    if default_role and default_role != "{}":
        try:
            role = json.loads(default_role)
            auth_type = role.get("auth", "")
            if auth_type == "none":
                return {"type": "none"}
            if auth_type == "apikey":
                return {"type": "apikey", "apikey": role.get("apikey", "")}
            if auth_type == "basic":
                return {
                    "type": "basic",
                    "username": role.get("username", ""),
                    "password": role.get("password", ""),
                }
        except (json.JSONDecodeError, AttributeError):
            pass
    # 3. HTTPPROXY_USER / HTTPPROXY_PASSWORD fallback
    user = env.get("HTTPPROXY_USER", "")
    password = env.get("HTTPPROXY_PASSWORD", "")
    if user or password:
        return {"type": "basic", "username": user, "password": password}
    return None


def _build_request_kwargs(auth: dict[str, Any] | None) -> dict[str, Any]:
    """Build kwargs dict for requests.get() based on auth info."""
    kwargs: dict[str, Any] = {"timeout": 3}
    if auth is None:
        return kwargs
    if auth["type"] == "basic":
        kwargs["auth"] = (auth["username"], auth["password"])
    elif auth["type"] == "apikey":
        kwargs["headers"] = {"X-API-Key": auth["apikey"]}
    # type == "none" → no auth needed
    return kwargs


def _get_docker_host_ip() -> str | None:
    """Get the Docker host IP reachable from within a container."""
    # Try host.docker.internal (Docker Desktop on Windows/Mac)
    try:
        return socket.gethostbyname("host.docker.internal")
    except socket.gaierror:
        pass
    # Fall back to default bridge gateway
    client = _get_client()
    try:
        networks = client.networks.list(names=["bridge"])
        if networks:
            ipam_config = networks[0].attrs.get("IPAM", {}).get("Config", [])
            if ipam_config:
                gateway = ipam_config[0].get("Gateway")
                if gateway:
                    return gateway
    except Exception:
        pass
    return "172.17.0.1"  # Common Linux default


def _get_container_published_port(
    container_id: str, internal_port: str = "8000/tcp"
) -> int | None:
    """Get the published host port for a container's internal port."""
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        port_bindings = (
            container.attrs.get("HostConfig", {}).get("PortBindings", {}) or {}
        )
        bindings = port_bindings.get(internal_port, [])
        if bindings:
            port = int(bindings[0].get("HostPort", 0))
            return port if port > 0 else None
    except Exception:
        pass
    return None


def _get_gluetun_base_url(
    container_id: str,
    auth: dict[str, Any] | None = None,
    debug_info: dict[str, Any] | None = None,
) -> str | None:
    """Determine the best reachable URL for the Gluetun control server.
    Tries internal IP first (same Docker network), then falls back to
    Docker host gateway + published port (cross-network).
    """
    probe_kwargs = _build_request_kwargs(auth)
    probe_kwargs["timeout"] = 2  # shorter timeout for probes

    # 1. Try internal IP on port 8000
    ip = _get_container_ip(container_id)
    if debug_info is not None:
        debug_info["internal_ip"] = ip
    if ip:
        internal_url = f"http://{ip}:8000"
        try:
            http_requests.get(f"{internal_url}/v1/vpn/status", **probe_kwargs)
            # Any response (even 401) means it's reachable
            if debug_info is not None:
                debug_info["connection_method"] = "internal"
            return internal_url
        except Exception:
            if debug_info is not None:
                debug_info["internal_ip_reachable"] = False

    # 2. Fall back to host gateway + published port
    host_ip = _get_docker_host_ip()
    published_port = _get_container_published_port(container_id)
    if debug_info is not None:
        debug_info["host_ip"] = host_ip
        debug_info["published_port"] = published_port
    if host_ip and published_port:
        host_url = f"http://{host_ip}:{published_port}"
        try:
            http_requests.get(f"{host_url}/v1/vpn/status", **probe_kwargs)
            if debug_info is not None:
                debug_info["connection_method"] = "host_gateway"
            return host_url
        except Exception:
            if debug_info is not None:
                debug_info["host_gateway_reachable"] = False

    if debug_info is not None:
        debug_info["connection_method"] = "none"
    return None


def get_gluetun_vpn_info(container_id: str, debug: bool = False) -> dict:
    """Query the Gluetun control server for VPN status and public IP.
    Tries internal container IP first, falls back to host gateway + published port.
    """
    result: dict[str, Any] = {
        "vpn_status": None,
        "public_ip": None,
        "country": None,
        "region": None,
        "port_forwarded": None,
    }
    debug_info: dict[str, Any] | None = {} if debug else None

    auth = _get_gluetun_auth(container_id)
    if debug and debug_info is not None:
        debug_info["container_id"] = container_id
        debug_info["auth_type"] = auth["type"] if auth else "missing"
        debug_info["errors"] = []

    base = _get_gluetun_base_url(container_id, auth, debug_info)
    if not base:
        if debug and debug_info is not None:
            debug_info["errors"].append(
                "Could not reach Gluetun control server (tried internal IP and host gateway)"
            )
            result["_debug"] = debug_info
        return result

    req_kwargs = _build_request_kwargs(auth)
    if debug and debug_info is not None:
        debug_info["base_url"] = base

    # VPN status
    try:
        resp = http_requests.get(f"{base}/v1/vpn/status", **req_kwargs)
        if debug and debug_info is not None:
            debug_info["vpn_status_code"] = resp.status_code
            debug_info["vpn_status_body"] = resp.text[:500]
        if resp.ok:
            data = resp.json()
            result["vpn_status"] = data.get("status")
    except Exception as e:
        logger.debug("Gluetun VPN status query failed for %s: %s", container_id, e)
        if debug and debug_info is not None:
            debug_info["errors"].append(f"VPN status: {e}")

    # Public IP
    try:
        resp = http_requests.get(f"{base}/v1/publicip/ip", **req_kwargs)
        if debug and debug_info is not None:
            debug_info["publicip_status_code"] = resp.status_code
            debug_info["publicip_body"] = resp.text[:500]
        if resp.ok:
            data = resp.json()
            result["public_ip"] = data.get("public_ip") or data.get("ip")
            result["country"] = data.get("country")
            result["region"] = data.get("region")
    except Exception as e:
        logger.debug("Gluetun public IP query failed for %s: %s", container_id, e)
        if debug and debug_info is not None:
            debug_info["errors"].append(f"Public IP: {e}")
    # Port forwarding
    try:
        resp = http_requests.get(f"{base}/v1/openvpn/portforwarded", **req_kwargs)
        if resp.ok:
            data = resp.json()
            port = data.get("port", 0)
            if port and port > 0:
                result["port_forwarded"] = port
    except Exception:
        pass
    if debug:
        result["_debug"] = debug_info
    return result


def find_container_by_name(name: str, vpn_provider: str | None = None) -> dict | None:
    """Try to find a Docker container by name or label.
    Tries 'gluetun-{name}', '{name}', then searches managed containers
    by vpn-proxy-name label. Does NOT do fuzzy matching to avoid
    accidentally linking to the wrong container.
    """
    client = _get_client()
    # Direct name lookup
    for candidate in [f"gluetun-{name}", name]:
        try:
            container = client.containers.get(candidate)
            return {
                "container_id": container.id,
                "status": container.status,
            }
        except (NotFound, APIError):
            continue
    # Fallback: search by label (handles renamed containers created by vpn-proxy)
    try:
        managed = client.containers.list(
            all=True, filters={"label": f"{CONTAINER_LABEL}={CONTAINER_LABEL_VALUE}"}
        )
        for container in managed:
            labels = container.labels or {}
            if labels.get("vpn-proxy-name") == name:
                return {
                    "container_id": container.id,
                    "status": container.status,
                }
    except Exception:
        pass
    return None


def get_container_docker_name(container_id: str) -> str | None:
    """Get the current Docker name of a container by its ID."""
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        name = container.name or ""
        return name.lstrip("/")
    except (NotFound, APIError):
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


def _is_gluetun_container(container) -> bool:
    """Check if a Docker container is likely a Gluetun VPN container.
    Only checks image name and container name — NOT hostname,
    because containers using network_mode:container:gluetun inherit its hostname."""
    try:
        image_tags = container.image.tags if container.image else []
        image_str = " ".join(image_tags).lower()
        config_image = container.attrs.get("Config", {}).get("Image", "").lower()
        name = (container.name or "").lower()
        return any("gluetun" in s for s in (image_str, config_image, name))
    except Exception:
        return False


def list_all_docker_containers() -> list[dict]:
    """List all Docker containers except managed Gluetun ones and the vpn-proxy manager itself.
    Includes info about whether a container is connected to a Gluetun VPN."""
    client = _get_client()
    result = []
    try:
        # Get all managed Gluetun containers
        managed = client.containers.list(
            all=True, filters={"label": f"{CONTAINER_LABEL}={CONTAINER_LABEL_VALUE}"}
        )
        managed_ids = set()
        managed_names = set()
        gluetun_map: dict[str, str] = {}
        for m in managed:
            mid = m.id or ""
            mname = m.name or ""
            managed_ids.add(mid)
            managed_names.add(mname)
            gluetun_map[mid] = mname
            gluetun_map[mname] = mname

        # Also find non-managed Gluetun containers (external docker-compose etc.)
        external_gluetun_map: dict[str, str] = {}  # id/name -> name
        for c in client.containers.list(all=True):
            cid = c.id or ""
            if cid in managed_ids:
                continue
            if _is_gluetun_container(c):
                cname = c.name or ""
                external_gluetun_map[cid] = cname
                external_gluetun_map[cname] = cname

        # Build a map of VPN-dedicated networks each Gluetun container is connected to
        # Only include networks with "gluetun" or "vpn" in name to avoid false positives
        # on generic shared networks (e.g. "proxy", "default", "compose_default")
        gluetun_networks: dict[str, str] = {}  # network_id -> gluetun_name
        _skip_nets = ("bridge", "host", "none")
        all_gluetun = list(managed)
        for c in client.containers.list(all=True):
            if (c.id or "") in external_gluetun_map:
                all_gluetun.append(c)
        for m in all_gluetun:
            try:
                nets = m.attrs.get("NetworkSettings", {}).get("Networks", {})
                for net_name, net_info in nets.items():
                    net_id = net_info.get("NetworkID", "")
                    net_lower = net_name.lower()
                    if (
                        net_id
                        and net_name not in _skip_nets
                        and ("gluetun" in net_lower or "vpn" in net_lower)
                    ):
                        gluetun_networks[net_id] = m.name or ""
            except Exception:
                continue

        # Combined map of all known Gluetun containers (managed + external)
        all_gluetun_map = {**gluetun_map, **external_gluetun_map}
        all_gluetun_ids = managed_ids | set(
            cid
            for cid in external_gluetun_map
            if len(cid) == 64  # full container IDs only
        )

        for c in client.containers.list(all=True):
            try:
                cid = c.id or ""
                cname = c.name or ""
                # Skip managed Gluetun containers
                if cid in managed_ids:
                    continue
                # Skip external Gluetun containers
                if cid in external_gluetun_map:
                    continue
                # Skip the vpn-proxy manager itself
                if cname in ("vpn-proxy", "vpn-proxy-manager"):
                    continue

                network_mode = c.attrs.get("HostConfig", {}).get("NetworkMode", "")
                vpn_parent = None

                # Method 1: network_mode: container:<ref>
                if network_mode.startswith("container:"):
                    ref = network_mode.split(":", 1)[1]
                    # Check against all known Gluetun containers
                    if ref in all_gluetun_map:
                        vpn_parent = all_gluetun_map[ref]
                    else:
                        for gid in all_gluetun_ids:
                            if gid.startswith(ref) or ref.startswith(gid[:12]):
                                vpn_parent = all_gluetun_map.get(gid, ref)
                                break
                    # Fallback: resolve the referenced container and check if it's Gluetun
                    if not vpn_parent:
                        try:
                            parent_container = client.containers.get(ref)
                            if _is_gluetun_container(parent_container):
                                vpn_parent = parent_container.name or ref[:12]
                        except Exception:
                            pass

                # Method 2: Shared Docker network with a Gluetun container
                if not vpn_parent:
                    try:
                        c_nets = c.attrs.get("NetworkSettings", {}).get("Networks", {})
                        for net_name, net_info in c_nets.items():
                            net_id = net_info.get("NetworkID", "")
                            if net_id in gluetun_networks:
                                vpn_parent = gluetun_networks[net_id]
                                break
                    except Exception:
                        pass

                image_tags = c.image.tags if c.image else []
                # Get health status
                docker_status = c.status
                health = c.attrs.get("State", {}).get("Health", {})
                health_status = health.get("Status")
                if docker_status == "running" and health_status in (
                    "healthy",
                    "unhealthy",
                    "starting",
                ):
                    docker_status = health_status

                result.append(
                    {
                        "name": cname,
                        "id": c.short_id,
                        "container_id": cid,
                        "status": docker_status,
                        "image": (
                            image_tags[0]
                            if image_tags
                            else c.attrs.get("Config", {}).get("Image", "unknown")
                        ),
                        "vpn_parent": vpn_parent,
                    }
                )
            except Exception:
                continue
    except Exception as e:
        logger.error("Failed to list all Docker containers: %s", e)
    return result


def list_all_docker_containers_debug() -> list[dict]:
    """Debug version: returns detection details for each container."""
    client = _get_client()
    result = []
    try:
        managed = client.containers.list(
            all=True, filters={"label": f"{CONTAINER_LABEL}={CONTAINER_LABEL_VALUE}"}
        )
        managed_ids = set()
        gluetun_map: dict[str, str] = {}
        for m in managed:
            mid = m.id or ""
            mname = m.name or ""
            managed_ids.add(mid)
            gluetun_map[mid] = mname
            gluetun_map[mname] = mname

        external_gluetun_map: dict[str, str] = {}
        for c in client.containers.list(all=True):
            cid = c.id or ""
            if cid in managed_ids:
                continue
            if _is_gluetun_container(c):
                cname = c.name or ""
                external_gluetun_map[cid] = cname
                external_gluetun_map[cname] = cname

        gluetun_networks: dict[str, str] = {}
        _skip_nets = ("bridge", "host", "none")
        all_gluetun_containers = list(managed)
        for c in client.containers.list(all=True):
            if (c.id or "") in external_gluetun_map:
                all_gluetun_containers.append(c)
        for m in all_gluetun_containers:
            try:
                nets = m.attrs.get("NetworkSettings", {}).get("Networks", {})
                for net_name, net_info in nets.items():
                    net_id = net_info.get("NetworkID", "")
                    net_lower = net_name.lower()
                    if (
                        net_id
                        and net_name not in _skip_nets
                        and ("gluetun" in net_lower or "vpn" in net_lower)
                    ):
                        gluetun_networks[net_id] = m.name or ""
            except Exception:
                continue

        all_gluetun_map = {**gluetun_map, **external_gluetun_map}

        for c in client.containers.list(all=True):
            try:
                cid = c.id or ""
                cname = c.name or ""
                if cid in managed_ids or cid in external_gluetun_map:
                    continue
                if cname in ("vpn-proxy", "vpn-proxy-manager"):
                    continue

                network_mode = c.attrs.get("HostConfig", {}).get("NetworkMode", "")
                c_nets = c.attrs.get("NetworkSettings", {}).get("Networks", {})
                network_names = list(c_nets.keys())
                network_ids = [ni.get("NetworkID", "")[:12] for ni in c_nets.values()]

                vpn_parent = None
                detection_method = None

                if network_mode.startswith("container:"):
                    ref = network_mode.split(":", 1)[1]
                    if ref in all_gluetun_map:
                        vpn_parent = all_gluetun_map[ref]
                        detection_method = "method1_direct"
                    else:
                        try:
                            parent_container = client.containers.get(ref)
                            is_gluetun = _is_gluetun_container(parent_container)
                            if is_gluetun:
                                vpn_parent = parent_container.name or ref[:12]
                                detection_method = "method1_fallback_gluetun"
                            else:
                                detection_method = f"method1_skipped_not_gluetun(parent={parent_container.name})"
                        except Exception:
                            detection_method = "method1_failed_resolve"

                if not vpn_parent:
                    for net_name, net_info in c_nets.items():
                        net_id = net_info.get("NetworkID", "")
                        if net_id in gluetun_networks:
                            vpn_parent = gluetun_networks[net_id]
                            detection_method = f"method2_shared_network({net_name})"
                            break

                if not detection_method:
                    detection_method = "none"

                result.append(
                    {
                        "name": cname,
                        "network_mode": network_mode,
                        "networks": network_names,
                        "network_ids": network_ids,
                        "vpn_parent": vpn_parent,
                        "detection_method": detection_method,
                        "is_o11": bool("o11" in cname.lower()),
                    }
                )
            except Exception as ex:
                result.append({"name": cname, "error": str(ex)})
    except Exception as e:
        return [{"error": str(e)}]

    # Also include detected gluetun info
    gluetun_info = {
        "managed_gluetun": {v: k[:12] for k, v in gluetun_map.items() if len(k) == 64},
        "external_gluetun": {
            v: k[:12] for k, v in external_gluetun_map.items() if len(k) == 64
        },
        "gluetun_networks": {v: k[:12] for k, v in gluetun_networks.items()},
    }
    return [gluetun_info] + result


def inspect_container_by_name(container_name: str) -> dict | None:
    """Get detailed info about any Docker container by name."""
    client = _get_client()
    try:
        container = client.containers.get(container_name)
    except NotFound:
        return None
    except APIError:
        return None

    attrs = container.attrs or {}
    config = attrs.get("Config", {})
    host_config = attrs.get("HostConfig", {})
    state = attrs.get("State", {})
    network_settings = attrs.get("NetworkSettings", {})

    image_tags = container.image.tags if container.image else []
    image_str = image_tags[0] if image_tags else config.get("Image", "unknown")

    # Status with health
    docker_status = container.status
    health = state.get("Health", {})
    health_status = health.get("Status")
    if docker_status == "running" and health_status in (
        "healthy",
        "unhealthy",
        "starting",
    ):
        docker_status = health_status

    # Network mode — resolve container ID to name
    network_mode = host_config.get("NetworkMode", "")
    if network_mode.startswith("container:"):
        ref = network_mode.split(":", 1)[1]
        try:
            ref_container = client.containers.get(ref)
            network_mode = f"container:{ref_container.name}"
        except Exception:
            pass  # Keep original if resolution fails

    # Networks
    networks = {}
    for net_name, net_info in network_settings.get("Networks", {}).items():
        networks[net_name] = {
            "ip": net_info.get("IPAddress", ""),
            "gateway": net_info.get("Gateway", ""),
            "network_id": (net_info.get("NetworkID", "") or "")[:12],
        }

    # Environment variables
    env_list = config.get("Env", [])
    env_dict = {}
    for e in env_list:
        parts = e.split("=", 1)
        if len(parts) == 2:
            env_dict[parts[0]] = parts[1]

    # Port bindings
    port_bindings = host_config.get("PortBindings") or {}
    ports = {}
    for port_key, bindings in port_bindings.items():
        if bindings:
            ports[port_key] = bindings[0].get("HostPort", "")

    # Mounts / Volumes
    mounts = []
    for m in host_config.get("Binds", []) or []:
        parts = m.split(":")
        if len(parts) >= 2:
            mounts.append(
                {
                    "source": parts[0],
                    "target": parts[1],
                    "mode": parts[2] if len(parts) > 2 else "rw",
                }
            )

    # Restart policy
    restart_policy = host_config.get("RestartPolicy", {})

    # Created / Started
    created = attrs.get("Created", "")
    started = state.get("StartedAt", "")

    # Labels
    labels = config.get("Labels", {})

    return {
        "name": container.name,
        "id": container.short_id,
        "container_id": container.id,
        "status": docker_status,
        "image": image_str,
        "network_mode": network_mode,
        "networks": networks,
        "env": env_dict,
        "ports": ports,
        "mounts": mounts,
        "restart_policy": restart_policy,
        "labels": labels,
        "created": created,
        "started": started,
        "cmd": config.get("Cmd"),
        "entrypoint": config.get("Entrypoint"),
        "hostname": config.get("Hostname", ""),
    }


def change_container_network_mode(container_name: str, new_network_mode: str) -> dict:
    """Change a container's network_mode by recreating it with the same config."""
    client = _get_client()
    try:
        container = client.containers.get(container_name)
    except NotFound:
        raise RuntimeError(f"Container '{container_name}' not found")

    attrs = container.attrs or {}
    config = attrs.get("Config", {})
    host_config = attrs.get("HostConfig", {})
    old_network_mode = host_config.get("NetworkMode", "")
    container_name_clean = container.name

    # Collect config for recreation
    image = config.get("Image", "")
    env = config.get("Env", [])
    labels = config.get("Labels", {})
    cmd = config.get("Cmd")
    entrypoint = config.get("Entrypoint")
    hostname = config.get("Hostname", "")
    volumes = host_config.get("Binds") or []
    port_bindings = host_config.get("PortBindings") or {}
    restart_policy = host_config.get("RestartPolicy") or {}
    cap_add = host_config.get("CapAdd") or []
    cap_drop = host_config.get("CapDrop") or []
    security_opt = host_config.get("SecurityOpt") or []
    privileged = host_config.get("Privileged", False)
    devices = host_config.get("Devices") or []

    was_running = container.status == "running"

    # Stop and remove old container
    if was_running:
        container.stop(timeout=10)
    container.remove()

    # Build ports config for the new network mode
    # If switching to container: mode, port bindings should typically be empty
    # (the parent handles ports), but we preserve them for the user
    exposed_ports = config.get("ExposedPorts") or {}

    # Determine hostname behavior
    # If using container: network mode, don't set hostname (inherited from parent)
    create_kwargs = {
        "image": image,
        "name": container_name_clean,
        "command": cmd,
        "entrypoint": entrypoint,
        "environment": env,
        "labels": labels,
        "network_mode": new_network_mode,
        "volumes": volumes,
        "restart_policy": restart_policy,
        "detach": True,
    }

    if cap_add:
        create_kwargs["cap_add"] = cap_add
    if cap_drop:
        create_kwargs["cap_drop"] = cap_drop
    if security_opt:
        create_kwargs["security_opt"] = security_opt
    if privileged:
        create_kwargs["privileged"] = privileged
    if devices:
        create_kwargs["devices"] = devices

    if new_network_mode.startswith("container:"):
        # In container: mode, ports are handled by the parent
        create_kwargs["ports"] = {}
    else:
        create_kwargs["ports"] = port_bindings
        if hostname:
            create_kwargs["hostname"] = hostname

    # Recreate
    new_container = client.containers.create(**create_kwargs)

    if was_running:
        new_container.start()

    return {
        "message": f"Container '{container_name_clean}' recreated with network_mode '{new_network_mode}'",
        "old_network_mode": old_network_mode,
        "new_network_mode": new_network_mode,
        "status": "running" if was_running else "created",
    }


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
    extra_ports: list[dict] | None = None,
    network_name: str | None = None,
) -> str:
    container_name = f"gluetun-{name}"
    api_key = secrets.token_urlsafe(32)
    env_vars = {
        "VPN_SERVICE_PROVIDER": vpn_provider,
        "VPN_TYPE": vpn_type,
        "HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE": json.dumps(
            {"auth": "apikey", "apikey": api_key}
        ),
    }
    for key, value in config.items():
        if value:
            env_vars[key] = str(value)

    # Build port list - only expose enabled services
    port_list: list[str] = []
    httpproxy_enabled = str(config.get("HTTPPROXY", "off")).lower() == "on"
    shadowsocks_enabled = str(config.get("SHADOWSOCKS", "off")).lower() == "on"
    if httpproxy_enabled and port_http_proxy > 0:
        port_list.append(f"{port_http_proxy}:8888")
    if shadowsocks_enabled and port_shadowsocks > 0:
        port_list.append(f"{port_shadowsocks}:8388/tcp")
        port_list.append(f"{port_shadowsocks}:8388/udp")

    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                port_list.append(f"{host}:{container_port}/{protocol}")

    service: dict[str, Any] = {
        "image": settings.GLUETUN_IMAGE,
        "container_name": container_name,
        "cap_add": ["NET_ADMIN"],
        "devices": ["/dev/net/tun:/dev/net/tun"],
        "environment": env_vars,
        "volumes": [f"./gluetun/{name}:/gluetun"],
        "restart": "unless-stopped",
    }
    if port_list:
        service["ports"] = port_list
    if network_name:
        service["networks"] = [network_name]

    compose: dict[str, Any] = {"services": {container_name: service}}
    if network_name:
        compose["networks"] = {network_name: {"external": True}}
    return yaml.dump(compose, default_flow_style=False, sort_keys=False)


def list_docker_networks() -> list[dict]:
    """List all Docker networks."""
    client = _get_client()
    result = []
    try:
        for net in client.networks.list():
            driver = net.attrs.get("Driver", "")
            result.append(
                {
                    "name": net.name,
                    "driver": driver,
                    "scope": net.attrs.get("Scope", ""),
                }
            )
    except Exception as e:
        logger.error("Failed to list Docker networks: %s", e)
    return result


def list_docker_stacks() -> list[str]:
    """List all Docker Compose stacks (projects) by inspecting container labels."""
    client = _get_client()
    stacks: set[str] = set()
    try:
        for c in client.containers.list(all=True):
            labels = c.labels or {}
            project = labels.get("com.docker.compose.project", "")
            if project:
                stacks.add(project)
    except Exception as e:
        logger.error("Failed to list Docker stacks: %s", e)
    return sorted(stacks)


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

            # Build config dict from VPN-related env vars (whitelist only)
            vpn_config = {k: v for k, v in env_vars.items() if k in ALLOWED_CONFIG_KEYS}

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
