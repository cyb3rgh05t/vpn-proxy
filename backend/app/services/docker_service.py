import json
import logging
import os
import secrets
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
import docker
import requests as http_requests
from docker.types import RestartPolicy  # noqa
import yaml
from docker.errors import ImageNotFound, NotFound, APIError
from app.config import settings

logger = logging.getLogger(__name__)

CONTAINER_LABEL = "managed-by"
CONTAINER_LABEL_VALUE = "vpn-proxy"
COMPOSE_PROJECT_LABEL = "com.docker.compose.project"
COMPOSE_PROJECT_VALUE = "vpn-proxy"
SOCKS5_IMAGE = "serjs/go-socks5-proxy:latest"
SOCKS5_LABEL = "vpn-proxy-socks5"

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
    """Filter config dict to include all whitelisted env var keys, showing empty for unset ones."""
    result = {k: "" for k in ALLOWED_CONFIG_KEYS}
    for k, v in config.items():
        if k in ALLOWED_CONFIG_KEYS:
            result[k] = v or ""
    return result


def _get_client():
    _docker_error_throttle: dict = getattr(_get_client, "_throttle", {})
    try:
        return docker.from_env()
    except Exception as e:
        now = time.monotonic()
        last_logged = _docker_error_throttle.get("ts", 0)
        if now - last_logged > 30:
            logger.error("Failed to connect to Docker daemon: %s", e)
            _docker_error_throttle["ts"] = now
            _get_client._throttle = _docker_error_throttle  # type: ignore[attr-defined]
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


def create_socks5_sidecar(
    name: str, gluetun_container_name: str, port: int = 1080
) -> str | None:
    """Create a SOCKS5 proxy sidecar container that shares the Gluetun container's network.
    The socks5 container listens on the given port inside Gluetun's network namespace.
    Returns the socks5 container ID.
    """
    client = _get_client()
    socks5_name = f"socks5-{name}"
    try:
        # Pull image if not available locally
        try:
            client.images.get(SOCKS5_IMAGE)
        except ImageNotFound:
            logger.info("Pulling SOCKS5 image %s ...", SOCKS5_IMAGE)
            client.images.pull(SOCKS5_IMAGE)

        container = client.containers.run(
            image=SOCKS5_IMAGE,
            name=socks5_name,
            network_mode=f"container:{gluetun_container_name}",
            environment={"REQUIRE_AUTH": "false", "PROXY_PORT": str(port)},
            detach=True,
            restart_policy={"Name": "unless-stopped", "MaximumRetryCount": 0},  # type: ignore[arg-type]
            labels={
                CONTAINER_LABEL: CONTAINER_LABEL_VALUE,
                COMPOSE_PROJECT_LABEL: COMPOSE_PROJECT_VALUE,
                SOCKS5_LABEL: name,
            },
        )
        logger.info("Created SOCKS5 sidecar %s for %s", socks5_name, name)
        return container.id
    except APIError as e:
        logger.error("Failed to create SOCKS5 sidecar %s: %s", socks5_name, e)
        return None


def remove_socks5_sidecar(name: str) -> bool:
    """Remove the SOCKS5 sidecar container for a given VPN container name."""
    client = _get_client()
    socks5_name = f"socks5-{name}"
    try:
        container = client.containers.get(socks5_name)
        container.remove(force=True)
        logger.info("Removed SOCKS5 sidecar %s", socks5_name)
        return True
    except NotFound:
        return True
    except APIError as e:
        logger.error("Failed to remove SOCKS5 sidecar %s: %s", socks5_name, e)
        return False


def _build_auth_toml(api_key: str) -> str:
    return (
        "[[roles]]\n"
        'name = "vpn-proxy"\n'
        "routes = [\n"
        '  "GET /v1/vpn/status",\n'
        '  "GET /v1/publicip/ip",\n'
        '  "GET /v1/openvpn/portforwarded",\n'
        '  "GET /v1/openvpn/settings",\n'
        '  "GET /v1/dns/status",\n'
        '  "GET /v1/version"\n'
        "]\n"
        'auth = "apikey"\n'
        f'apikey = "{api_key}"\n'
    )


def ensure_gluetun_auth_config(name: str) -> bool:
    """Ensure the auth config.toml on disk matches the running container's
    HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE apikey. Returns True if the file was
    just (re)written and the container should be restarted, False if nothing
    changed (or on error).
    """
    container_name = f"gluetun-{name}"
    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    auth_dir = os.path.join(gluetun_data, "auth")
    auth_path = os.path.join(auth_dir, "config.toml")

    # Read api_key from the running container's env vars
    try:
        client = _get_client()
        container = client.containers.get(container_name)
        env_list = container.attrs.get("Config", {}).get("Env", []) or []
        env = {}
        for entry in env_list:
            if "=" in entry:
                k, v = entry.split("=", 1)
                env[k] = v
        raw = env.get("HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE", "")
        api_key = ""
        if raw:
            try:
                api_key = (json.loads(raw) or {}).get("apikey", "")
            except Exception:
                api_key = ""
        if not api_key:
            logger.warning(
                "Cannot repair Gluetun auth for %s: no apikey env var found",
                container_name,
            )
            return False

        # If file already contains the same apikey, nothing to do
        try:
            if os.path.isfile(auth_path):
                with open(auth_path, "r", encoding="utf-8") as f:
                    existing = f.read()
                if f'apikey = "{api_key}"' in existing:
                    return False
        except OSError:
            pass

        os.makedirs(auth_dir, exist_ok=True)
        with open(auth_path, "w", encoding="utf-8") as f:
            f.write(_build_auth_toml(api_key))
        logger.info(
            "Repaired Gluetun auth config for %s at %s", container_name, auth_path
        )
        return True
    except NotFound:
        return False
    except Exception as e:
        logger.warning(
            "Failed to ensure Gluetun auth config for %s: %s", container_name, e
        )
        return False


def create_container(
    name: str,
    vpn_provider: str,
    vpn_type: str,
    config: dict,
    port_http_proxy: int = 8888,
    port_shadowsocks: int = 8388,
    extra_ports: list[dict] | None = None,
    extra_hosts: list[str] | None = None,
    network_name: str | None = None,
    devices: list[str] | None = None,
    hostname: str | None = None,
    custom_labels: dict[str, str] | None = None,
    cap_add: list[str] | None = None,
    gluetun_image: str | None = None,
    socks5_enabled: bool = False,
    port_socks5: int = 1080,
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

    # If the user-supplied config (e.g. from a previous deploy stored in the DB)
    # carries an existing HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE with an apikey,
    # use that key so it stays in sync with the env var. Otherwise stick with
    # the freshly generated one and make sure the env var reflects it.
    existing_role_raw = env_vars.get("HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE", "")
    try:
        existing_role = json.loads(existing_role_raw) if existing_role_raw else {}
    except (json.JSONDecodeError, TypeError):
        existing_role = {}
    existing_apikey = (
        existing_role.get("apikey", "") if isinstance(existing_role, dict) else ""
    )
    if existing_role.get("auth") == "apikey" and existing_apikey:
        api_key = existing_apikey
    else:
        env_vars["HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE"] = json.dumps(
            {"auth": "apikey", "apikey": api_key}
        )

    gluetun_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    os.makedirs(gluetun_data, exist_ok=True)

    # Write Gluetun control-server auth config (required since Gluetun v3.40,
    # which enforces auth on all routes by default). The backend reads the
    # apikey from the env var above for discovery; Gluetun reads it from the
    # mounted /gluetun/auth/config.toml file to actually enforce it.
    auth_dir = os.path.join(gluetun_data, "auth")
    os.makedirs(auth_dir, exist_ok=True)
    auth_config_path = os.path.join(auth_dir, "config.toml")
    auth_toml = _build_auth_toml(api_key)
    try:
        with open(auth_config_path, "w", encoding="utf-8") as f:
            f.write(auth_toml)
        logger.info("Wrote Gluetun auth config to %s", auth_config_path)
    except OSError as e:
        logger.warning(
            "Failed to write Gluetun auth config %s: %s", auth_config_path, e
        )

    # Use HOST_DATA_DIR for Docker bind mounts when running inside a container
    if settings.HOST_DATA_DIR:
        gluetun_mount = os.path.join(settings.HOST_DATA_DIR, "gluetun", name)
    else:
        gluetun_mount = gluetun_data

    # Debug: log mount paths and files in gluetun data dir
    logger.info(
        "Container %s mount paths: HOST_DATA_DIR=%r, gluetun_data=%s, gluetun_mount=%s",
        name,
        settings.HOST_DATA_DIR,
        gluetun_data,
        gluetun_mount,
    )
    try:
        files_in_data = os.listdir(gluetun_data)
        logger.info("Files in %s: %s", gluetun_data, files_in_data)
    except Exception as e:
        logger.warning("Cannot list %s: %s", gluetun_data, e)

    # Build port mappings
    # HTTP proxy is NOT auto-exported; use extra_ports for external access
    ports = {}
    shadowsocks_enabled = str(config.get("SHADOWSOCKS", "off")).lower() == "on"

    if shadowsocks_enabled and port_shadowsocks > 0:
        ports["8388/tcp"] = port_shadowsocks
        ports["8388/udp"] = port_shadowsocks
    # Control port 8000 is NOT exposed - accessed internally only
    # SOCKS5 port 1080 is NOT auto-exported; use extra_ports for external access

    # Add extra port mappings
    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                ports[f"{container_port}/{protocol}"] = host

    try:
        base_devices = ["/dev/net/tun:/dev/net/tun"]
        if devices:
            for d in devices:
                if d and d not in base_devices:
                    base_devices.append(d)
        base_cap_add = ["NET_ADMIN"]
        if cap_add:
            for c in cap_add:
                if c and c not in base_cap_add:
                    base_cap_add.append(c)
        base_labels = {
            CONTAINER_LABEL: CONTAINER_LABEL_VALUE,
            COMPOSE_PROJECT_LABEL: COMPOSE_PROJECT_VALUE,
            "vpn-proxy-name": name,
        }
        if custom_labels:
            for k, v in custom_labels.items():
                if k and k not in base_labels:
                    base_labels[k] = str(v)
        run_kwargs: dict[str, Any] = {
            "image": gluetun_image or settings.GLUETUN_IMAGE,
            "name": container_name,
            "cap_add": base_cap_add,
            "devices": base_devices,
            "environment": env_vars,
            "ports": ports,
            "volumes": {gluetun_mount: {"bind": "/gluetun", "mode": "rw"}},
            "detach": True,
            "restart_policy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
            "labels": base_labels,
        }
        if hostname:
            run_kwargs["hostname"] = hostname
        if network_name:
            run_kwargs["network"] = network_name
        if extra_hosts:
            # Docker SDK expects a dict {"hostname": "ip"}, input is ["hostname:ip", ...]
            hosts_dict: dict[str, str] = {}
            for entry in extra_hosts:
                parts = entry.rsplit(":", 1)
                if len(parts) == 2:
                    hosts_dict[parts[0].strip()] = parts[1].strip()
            if hosts_dict:
                run_kwargs["extra_hosts"] = hosts_dict
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


def _capture_dependent_config(container) -> dict:
    """Snapshot a Docker container's config so we can recreate it later
    against a (possibly new) `network_mode: container:<gluetun>` target.
    """
    attrs = container.attrs or {}
    cfg = attrs.get("Config", {}) or {}
    host = attrs.get("HostConfig", {}) or {}
    image_tags = container.image.tags if container.image else []
    image = image_tags[0] if image_tags else cfg.get("Image", "")

    env_dict: dict[str, str] = {}
    for entry in cfg.get("Env", []) or []:
        if isinstance(entry, str) and "=" in entry:
            k, v = entry.split("=", 1)
            env_dict[k] = v

    return {
        "name": (container.name or "").lstrip("/"),
        "id": container.id,
        "short_id": container.short_id,
        "image": image,
        "command": cfg.get("Cmd"),
        "entrypoint": cfg.get("Entrypoint"),
        "environment": env_dict,
        "labels": dict(cfg.get("Labels") or {}),
        "binds": list(host.get("Binds") or []),
        "devices": list(host.get("Devices") or []),
        "cap_add": list(host.get("CapAdd") or []),
        "cap_drop": list(host.get("CapDrop") or []),
        "security_opt": list(host.get("SecurityOpt") or []),
        "restart_policy": dict(host.get("RestartPolicy") or {}),
        "extra_hosts": list(host.get("ExtraHosts") or []),
        "privileged": bool(host.get("Privileged") or False),
        "tty": bool(cfg.get("Tty") or False),
        "stdin_open": bool(cfg.get("OpenStdin") or False),
        "user": cfg.get("User") or None,
        "working_dir": cfg.get("WorkingDir") or None,
    }


def _recreate_dependent_on_network(captured: dict, network_mode: str) -> str:
    """Recreate a container previously captured with `_capture_dependent_config`
    against the given `network_mode` (typically `container:<new-gluetun-name>`).
    Returns the new container ID. Caller is responsible for removing the old one.
    """
    client = _get_client()

    devices_list: list[str] = []
    for d in captured.get("devices") or []:
        host_path = (d or {}).get("PathOnHost", "")
        cont_path = (d or {}).get("PathInContainer", "")
        perms = (d or {}).get("CgroupPermissions", "rwm")
        if host_path and cont_path:
            devices_list.append(f"{host_path}:{cont_path}:{perms}")

    run_kwargs: dict[str, Any] = {
        "image": captured["image"],
        "name": captured["name"],
        "network_mode": network_mode,
        "labels": captured.get("labels") or {},
        "detach": True,
    }
    if captured.get("environment"):
        run_kwargs["environment"] = captured["environment"]
    if captured.get("command") is not None:
        run_kwargs["command"] = captured["command"]
    if captured.get("entrypoint") is not None:
        run_kwargs["entrypoint"] = captured["entrypoint"]
    if captured.get("binds"):
        # Docker SDK accepts list of bind strings via `volumes=[...]`
        run_kwargs["volumes"] = list(captured["binds"])
    if devices_list:
        run_kwargs["devices"] = devices_list
    if captured.get("cap_add"):
        run_kwargs["cap_add"] = [c for c in captured["cap_add"] if c]
    if captured.get("cap_drop"):
        run_kwargs["cap_drop"] = [c for c in captured["cap_drop"] if c]
    if captured.get("security_opt"):
        run_kwargs["security_opt"] = [s for s in captured["security_opt"] if s]
    if captured.get("extra_hosts"):
        hosts_dict: dict[str, str] = {}
        for entry in captured["extra_hosts"]:
            if not isinstance(entry, str):
                continue
            parts = entry.rsplit(":", 1)
            if len(parts) == 2:
                hosts_dict[parts[0].strip()] = parts[1].strip()
        if hosts_dict:
            run_kwargs["extra_hosts"] = hosts_dict
    rp = captured.get("restart_policy") or {}
    if rp.get("Name"):
        run_kwargs["restart_policy"] = {
            "Name": rp.get("Name"),
            "MaximumRetryCount": int(rp.get("MaximumRetryCount") or 0),
        }
    if captured.get("user"):
        run_kwargs["user"] = captured["user"]
    if captured.get("working_dir"):
        run_kwargs["working_dir"] = captured["working_dir"]
    if captured.get("tty"):
        run_kwargs["tty"] = True
    if captured.get("stdin_open"):
        run_kwargs["stdin_open"] = True
    if captured.get("privileged"):
        run_kwargs["privileged"] = True

    new = client.containers.run(**run_kwargs)
    return new.id


def redeploy_container(
    name: str,
    old_container_id: str,
    vpn_provider: str,
    vpn_type: str,
    config: dict,
    port_http_proxy: int = 8888,
    port_shadowsocks: int = 8388,
    extra_ports: list[dict] | None = None,
    extra_hosts: list[str] | None = None,
    network_name: str | None = None,
    devices: list[str] | None = None,
    hostname: str | None = None,
    custom_labels: dict[str, str] | None = None,
    cap_add: list[str] | None = None,
    new_name: str | None = None,
    gluetun_image: str | None = None,
    socks5_enabled: bool = False,
    port_socks5: int = 1080,
) -> str | None:
    """Redeploy a Gluetun container with updated config.
    Stops dependents, keeps old container as rollback backup, creates new one,
    and restarts dependents.
    If new_name is provided, the container is renamed (new Docker name + data dir).
    Returns new container_id.
    """
    deploy_name = new_name if new_name else name
    client = _get_client()
    old_container = client.containers.get(old_container_id)
    old_docker_name = (old_container.name or "").lstrip("/")

    try:
        old_container.reload()
        was_running = old_container.status == "running"
    except Exception:
        was_running = True

    backup_container_name: str | None = None
    data_dir_renamed = False
    old_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", name)
    new_data = os.path.join(os.path.abspath(settings.DATA_DIR), "gluetun", deploy_name)

    had_socks5_sidecar = False
    try:
        client.containers.get(f"socks5-{name}")
        had_socks5_sidecar = True
    except NotFound:
        had_socks5_sidecar = False
    except Exception:
        had_socks5_sidecar = False

    # 1. Capture dependent container configs and stop them.
    #    Dependents use `network_mode: container:<old-gluetun>` and must be
    #    recreated against the new gluetun, because Docker resolves the
    #    container reference to a concrete ID at start time.
    captured_deps: list[dict] = []
    try:
        for dep_info in get_dependent_containers(old_container_id):
            try:
                dep_c = client.containers.get(dep_info["name"])
                snap = _capture_dependent_config(dep_c)
                snap["was_running"] = dep_c.status == "running"
                captured_deps.append(snap)
            except Exception as e:
                logger.warning(
                    "Failed to capture dependent %s config: %s", dep_info["name"], e
                )
    except Exception as e:
        logger.warning("Failed to enumerate dependents of %s: %s", name, e)

    for snap in captured_deps:
        try:
            dep_c = client.containers.get(snap["name"])
            try:
                dep_c.stop(timeout=10)
            except Exception:
                pass
            dep_c.remove(force=True)
        except NotFound:
            pass
        except Exception as e:
            logger.warning(
                "Failed to remove dependent %s before redeploy: %s", snap["name"], e
            )
    if captured_deps:
        logger.info(
            "Captured & removed %d dependents before redeploy of %s",
            len(captured_deps),
            name,
        )

    # 2. Remove old SOCKS5 sidecar if it exists (before removing gluetun)
    remove_socks5_sidecar(name)

    # 3. Keep old container as rollback backup by renaming it away
    backup_container_name = f"{old_docker_name}-backup-{int(time.time())}"
    try:
        old_container.stop(timeout=10)
    except Exception:
        pass
    old_container.rename(backup_container_name)
    logger.info(
        "Renamed old container %s -> %s for redeploy backup",
        old_docker_name,
        backup_container_name,
    )

    # 4. Rename data directory if name changed
    if new_name and new_name != name:
        if os.path.exists(old_data) and not os.path.exists(new_data):
            os.rename(old_data, new_data)
            data_dir_renamed = True
            logger.info("Renamed data dir %s -> %s", old_data, new_data)

    try:
        # 5. Pull latest image before recreating
        pull_image = gluetun_image or settings.GLUETUN_IMAGE
        try:
            logger.info("Pulling latest image %s for redeploy ...", pull_image)
            client.images.pull(pull_image)
        except Exception as e:
            logger.warning(
                "Failed to pull latest image %s, using local: %s", pull_image, e
            )

        # 6. Create new container with (possibly new) name and updated config
        new_id = create_container(
            name=deploy_name,
            vpn_provider=vpn_provider,
            vpn_type=vpn_type,
            config=config,
            port_http_proxy=port_http_proxy,
            port_shadowsocks=port_shadowsocks,
            extra_ports=extra_ports,
            extra_hosts=extra_hosts,
            network_name=network_name,
            devices=devices,
            hostname=hostname,
            custom_labels=custom_labels,
            cap_add=cap_add,
            gluetun_image=gluetun_image,
            socks5_enabled=socks5_enabled,
            port_socks5=port_socks5,
        )
        logger.info("Created new container %s for %s", new_id[:12], deploy_name)

        # 7. Remove backup old container after successful create
        try:
            backup = client.containers.get(backup_container_name)
            backup.remove(force=True)
            logger.info(
                "Removed backup container %s after successful redeploy",
                backup_container_name,
            )
        except Exception as e:
            logger.warning(
                "Failed to remove backup container %s: %s", backup_container_name, e
            )

        # 8. Recreate dependents against the NEW gluetun container.
        #    `deploy_name` may differ from the original `name` if the user
        #    renamed the gluetun. The new gluetun is named `gluetun-{deploy_name}`.
        new_gluetun_name = f"gluetun-{deploy_name}"
        new_network_mode = f"container:{new_gluetun_name}"
        recreated_deps: list[dict] = []
        for snap in captured_deps:
            try:
                new_dep_id = _recreate_dependent_on_network(snap, new_network_mode)
                recreated_deps.append(
                    {
                        "name": snap["name"],
                        "old_id": snap.get("id"),
                        "old_short_id": snap.get("short_id"),
                        "new_id": new_dep_id,
                    }
                )
                if not snap.get("was_running", True):
                    # Container was stopped before redeploy; stop the freshly
                    # recreated one to preserve previous state.
                    try:
                        client.containers.get(new_dep_id).stop(timeout=10)
                    except Exception:
                        pass
            except Exception as e:
                logger.error(
                    "Failed to recreate dependent %s on new gluetun: %s",
                    snap.get("name"),
                    e,
                )
        if captured_deps:
            logger.info(
                "Recreated %d/%d dependents against new gluetun %s",
                len(recreated_deps),
                len(captured_deps),
                new_gluetun_name,
            )

        # Stash mapping on a function attribute so the router can reconcile
        # O11Container DB records (their `container_id` changed).
        try:
            redeploy_container.last_recreated_dependents = recreated_deps  # type: ignore[attr-defined]
        except Exception:
            pass

        return new_id
    except Exception:
        # Rollback data dir rename if we changed it
        if (
            data_dir_renamed
            and os.path.exists(new_data)
            and not os.path.exists(old_data)
        ):
            try:
                os.rename(new_data, old_data)
                logger.info("Rolled back data dir rename %s -> %s", new_data, old_data)
            except Exception as e:
                logger.warning(
                    "Failed to roll back data dir rename %s -> %s: %s",
                    new_data,
                    old_data,
                    e,
                )

        # Restore old container name/state
        if backup_container_name:
            try:
                backup = client.containers.get(backup_container_name)
                backup.rename(old_docker_name)
                if was_running:
                    backup.start()
                logger.info(
                    "Restored old container %s after redeploy failure", old_docker_name
                )
            except Exception as e:
                logger.error(
                    "Failed to restore old container from backup %s: %s",
                    backup_container_name,
                    e,
                )

        # Restore old SOCKS5 sidecar if it existed before redeploy
        if had_socks5_sidecar:
            try:
                create_socks5_sidecar(name, old_docker_name, port_socks5)
            except Exception as e:
                logger.warning("Failed to restore SOCKS5 sidecar for %s: %s", name, e)

        # Recreate previously captured dependents pointing at the restored
        # old gluetun container, so they come back online after rollback.
        rollback_network_mode = f"container:{old_docker_name}"
        for snap in captured_deps:
            try:
                # If a partially-created replacement still exists from the
                # success path, get rid of it first.
                try:
                    existing = client.containers.get(snap["name"])
                    existing.remove(force=True)
                except NotFound:
                    pass
                except Exception:
                    pass
                new_dep_id = _recreate_dependent_on_network(snap, rollback_network_mode)
                if not snap.get("was_running", True):
                    try:
                        client.containers.get(new_dep_id).stop(timeout=10)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(
                    "Failed to recreate dependent %s after rollback: %s",
                    snap.get("name"),
                    e,
                )

        raise


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
    kwargs: dict[str, Any] = {"timeout": 2}
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
    probe_kwargs["timeout"] = 1  # short timeout for probes

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

    def _fetch_vpn_status():
        try:
            resp = http_requests.get(f"{base}/v1/vpn/status", **req_kwargs)
            if resp.ok:
                return "vpn_status", resp
        except Exception as e:
            logger.debug("Gluetun VPN status query failed for %s: %s", container_id, e)
            if debug and debug_info is not None:
                debug_info.setdefault("errors", []).append(f"VPN status: {e}")
        return "vpn_status", None

    def _fetch_public_ip():
        try:
            resp = http_requests.get(f"{base}/v1/publicip/ip", **req_kwargs)
            if resp.ok:
                return "publicip", resp
        except Exception as e:
            logger.debug("Gluetun public IP query failed for %s: %s", container_id, e)
            if debug and debug_info is not None:
                debug_info.setdefault("errors", []).append(f"Public IP: {e}")
        return "publicip", None

    def _fetch_port_forward():
        try:
            resp = http_requests.get(f"{base}/v1/openvpn/portforwarded", **req_kwargs)
            if resp.ok:
                return "portforward", resp
        except Exception:
            pass
        return "portforward", None

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [
            pool.submit(fn)
            for fn in (_fetch_vpn_status, _fetch_public_ip, _fetch_port_forward)
        ]
        for future in as_completed(futures):
            key, resp = future.result()
            if resp is None:
                continue
            if key == "vpn_status":
                if debug and debug_info is not None:
                    debug_info["vpn_status_code"] = resp.status_code
                    debug_info["vpn_status_body"] = resp.text[:500]
                data = resp.json()
                result["vpn_status"] = data.get("status")
            elif key == "publicip":
                if debug and debug_info is not None:
                    debug_info["publicip_status_code"] = resp.status_code
                    debug_info["publicip_body"] = resp.text[:500]
                data = resp.json()
                result["public_ip"] = data.get("public_ip") or data.get("ip")
                result["country"] = data.get("country")
                result["region"] = data.get("region")
            elif key == "portforward":
                data = resp.json()
                port = data.get("port", 0)
                if port and port > 0:
                    result["port_forwarded"] = port

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

                # Port bindings
                port_bindings = c.attrs.get("HostConfig", {}).get("PortBindings") or {}
                ports = {}
                for port_key, bindings in port_bindings.items():
                    if bindings:
                        ports[port_key] = bindings[0].get("HostPort", "")

                # Network info
                c_network_mode = network_mode
                hostname = c.attrs.get("Config", {}).get("Hostname", "")

                # Mounts count
                binds = c.attrs.get("HostConfig", {}).get("Binds") or []

                # Connected networks list
                c_nets = c.attrs.get("NetworkSettings", {}).get("Networks", {})
                connected_networks = list(c_nets.keys()) if c_nets else []

                # Labels
                container_labels = c.labels or {}

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
                        "ports": ports,
                        "network_mode": c_network_mode,
                        "hostname": hostname,
                        "mounts_count": len(binds),
                        "networks": connected_networks,
                        "labels": container_labels,
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
    labels[COMPOSE_PROJECT_LABEL] = COMPOSE_PROJECT_VALUE
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
    extra_hosts: list[str] | None = None,
    network_name: str | None = None,
    gluetun_image: str | None = None,
    socks5_enabled: bool = False,
    port_socks5: int = 1080,
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

    # Build port list
    # HTTP proxy is NOT auto-exported; use extra_ports for external access
    port_list: list[str] = []
    shadowsocks_enabled = str(config.get("SHADOWSOCKS", "off")).lower() == "on"
    if shadowsocks_enabled and port_shadowsocks > 0:
        port_list.append(f"{port_shadowsocks}:8388/tcp")
        port_list.append(f"{port_shadowsocks}:8388/udp")
    # SOCKS5 port 1080 is NOT auto-exported; use extra_ports for external access

    if extra_ports:
        for ep in extra_ports:
            host = int(ep.get("host", 0))
            container_port = int(ep.get("container", 0))
            protocol = ep.get("protocol", "tcp").lower()
            if host > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                port_list.append(f"{host}:{container_port}/{protocol}")

    service: dict[str, Any] = {
        "image": gluetun_image or settings.GLUETUN_IMAGE,
        "container_name": container_name,
        "cap_add": ["NET_ADMIN"],
        "devices": ["/dev/net/tun:/dev/net/tun"],
        "environment": env_vars,
        "volumes": [f"./gluetun/{name}:/gluetun"],
        "restart": "unless-stopped",
    }
    if port_list:
        service["ports"] = port_list
    if extra_hosts:
        service["extra_hosts"] = list(extra_hosts)
    if network_name:
        service["networks"] = [network_name]

    compose: dict[str, Any] = {"services": {container_name: service}}

    # Add SOCKS5 sidecar service
    if socks5_enabled:
        socks5_service: dict[str, Any] = {
            "image": SOCKS5_IMAGE,
            "container_name": f"socks5-{name}",
            "depends_on": [container_name],
            "network_mode": f"container:{container_name}",
            "environment": {"REQUIRE_AUTH": "false", "PROXY_PORT": str(port_socks5)},
            "restart": "unless-stopped",
        }
        compose["services"][f"socks5-{name}"] = socks5_service

    if network_name:
        compose["networks"] = {network_name: {"external": True}}
    return yaml.dump(compose, default_flow_style=False, sort_keys=False)


def generate_o11_compose_yaml(
    name: str,
    image: str,
    network_mode: str | None = "bridge",
    environment: dict | None = None,
    ports: list[dict] | None = None,
    volumes: list[dict] | None = None,
    devices: list[str] | None = None,
    restart_policy: str | None = "unless-stopped",
    command: str | None = None,
    hostname: str | None = None,
    custom_labels: dict | None = None,
    cap_add: list[str] | None = None,
    security_opt: list[str] | None = None,
) -> str:
    """Generate a docker-compose YAML for an O11/App container."""
    service: dict[str, Any] = {
        "image": image,
        "container_name": name,
    }

    if network_mode and network_mode != "bridge":
        service["network_mode"] = network_mode

    if (
        hostname
        and hostname.strip()
        and not (network_mode and network_mode.startswith("container:"))
    ):
        service["hostname"] = hostname.strip()

    env_clean: dict[str, str] = {}
    if environment:
        for k, v in environment.items():
            if v is not None and str(v).strip():
                env_clean[k] = str(v)
    if env_clean:
        service["environment"] = env_clean

    if cap_add:
        clean = [c for c in cap_add if c]
        if clean:
            service["cap_add"] = clean

    if security_opt:
        clean = [s for s in security_opt if s]
        if clean:
            service["security_opt"] = clean

    if devices:
        clean = [d for d in devices if d]
        if clean:
            service["devices"] = clean

    if volumes:
        vol_list: list[str] = []
        for v in volumes:
            source = (v.get("source") or "").strip()
            target = (v.get("target") or "").strip()
            mode = (v.get("mode") or "rw").strip()
            if source and target:
                vol_list.append(f"{source}:{target}:{mode}")
        if vol_list:
            service["volumes"] = vol_list

    if restart_policy:
        service["restart"] = restart_policy

    if ports and not (network_mode and network_mode.startswith("container:")):
        port_list: list[str] = []
        for p in ports:
            host_port = int(p.get("host", 0) or 0)
            container_port = int(p.get("container", 0) or 0)
            protocol = (p.get("protocol") or "tcp").lower()
            if host_port > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                if protocol == "udp":
                    port_list.append(f"{host_port}:{container_port}/udp")
                else:
                    port_list.append(f"{host_port}:{container_port}")
        if port_list:
            service["ports"] = port_list

    labels_dict: dict[str, str] = {
        "managed-by": "vpn-proxy-o11",
        COMPOSE_PROJECT_LABEL: COMPOSE_PROJECT_VALUE,
    }
    if custom_labels:
        for k, v in custom_labels.items():
            if k:
                labels_dict[k] = str(v)
    service["labels"] = labels_dict

    if command and command.strip():
        service["command"] = command.strip()

    compose = {"services": {name: service}}
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


def list_docker_volumes() -> list[dict]:
    """List all Docker named volumes."""
    client = _get_client()
    result = []
    try:
        for vol in client.volumes.list():
            result.append(
                {
                    "name": vol.name,
                    "driver": vol.attrs.get("Driver", ""),
                    "mountpoint": vol.attrs.get("Mountpoint", ""),
                    "labels": vol.attrs.get("Labels") or {},
                    "options": vol.attrs.get("Options") or {},
                    "scope": vol.attrs.get("Scope", ""),
                }
            )
    except Exception as e:
        logger.error("Failed to list Docker volumes: %s", e)
    return result


def create_docker_volume(
    name: str,
    driver: str = "local",
    driver_opts: dict | None = None,
    labels: dict | None = None,
) -> dict:
    """Create a Docker named volume with optional driver and driver_opts.

    Common usage:
        create_docker_volume("unionfs", driver="local-persist",
                             driver_opts={"mountpoint": "/mnt"})
    """
    client = _get_client()
    try:
        kwargs: dict[str, Any] = {"name": name, "driver": driver or "local"}
        if driver_opts:
            kwargs["driver_opts"] = {k: str(v) for k, v in driver_opts.items() if k}
        if labels:
            kwargs["labels"] = {k: str(v) for k, v in labels.items() if k}
        vol = client.volumes.create(**kwargs)
        return {
            "name": vol.name,
            "driver": vol.attrs.get("Driver", ""),
            "mountpoint": vol.attrs.get("Mountpoint", ""),
        }
    except APIError as e:
        logger.error("Failed to create volume %s: %s", name, e)
        raise


def remove_docker_volume(name: str, force: bool = False) -> bool:
    """Remove a Docker named volume."""
    client = _get_client()
    try:
        vol = client.volumes.get(name)
        vol.remove(force=force)
        return True
    except NotFound:
        return True
    except APIError as e:
        logger.error("Failed to remove volume %s: %s", name, e)
        raise


def create_o11_container(
    name: str,
    image: str,
    network_mode: str = "bridge",
    environment: dict | None = None,
    ports: dict | None = None,
    volumes: list[dict] | None = None,
    devices: list[str] | None = None,
    restart_policy: str = "unless-stopped",
    command: str | None = None,
    labels: dict | None = None,
    hostname: str | None = None,
    custom_labels: dict | None = None,
    cap_add: list[str] | None = None,
    security_opt: list[str] | None = None,
    extra_hosts: list[str] | None = None,
) -> str | None:
    """Create a generic Docker container (O11 container).
    Returns the container ID.
    """
    client = _get_client()

    # Pull image if not available locally
    try:
        client.images.get(image)
    except ImageNotFound:
        logger.info("Pulling image %s ...", image)
        client.images.pull(image)

    env_vars = {}
    if environment:
        for k, v in environment.items():
            if v is not None and str(v).strip():
                env_vars[k] = str(v)

    # Build port mappings: {"8080/tcp": 8080}
    port_bindings = {}
    if ports and not network_mode.startswith("container:"):
        for p in ports:
            host_port = int(p.get("host", 0))
            container_port = int(p.get("container", 0))
            protocol = p.get("protocol", "tcp").lower()
            if host_port > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                port_bindings[f"{container_port}/{protocol}"] = host_port

    # Build volume bindings: ["/host/path:/container/path:rw"]
    volume_bindings = {}
    if volumes:
        for v in volumes:
            source = v.get("source", "").strip()
            target = v.get("target", "").strip()
            mode = v.get("mode", "rw").strip()
            if source and target:
                volume_bindings[source] = {"bind": target, "mode": mode}

    # Build container labels
    container_labels = {
        "managed-by": "vpn-proxy-o11",
        COMPOSE_PROJECT_LABEL: COMPOSE_PROJECT_VALUE,
    }
    if labels:
        container_labels.update(labels)
    if custom_labels:
        for k, v in custom_labels.items():
            if k:
                container_labels[k] = str(v)

    run_kwargs: dict[str, Any] = {
        "image": image,
        "name": name,
        "environment": env_vars if env_vars else None,
        "ports": port_bindings if port_bindings else None,
        "volumes": volume_bindings if volume_bindings else None,
        "detach": True,
        "restart_policy": {"Name": restart_policy, "MaximumRetryCount": 0},
        "labels": container_labels,
    }

    if network_mode and network_mode != "bridge":
        run_kwargs["network_mode"] = network_mode

    if devices:
        run_kwargs["devices"] = devices

    if hostname and hostname.strip() and not network_mode.startswith("container:"):
        run_kwargs["hostname"] = hostname.strip()

    if cap_add:
        run_kwargs["cap_add"] = [c for c in cap_add if c]

    if security_opt:
        run_kwargs["security_opt"] = [s for s in security_opt if s]

    if extra_hosts and not network_mode.startswith("container:"):
        hosts_dict: dict[str, str] = {}
        for entry in extra_hosts:
            parts = entry.rsplit(":", 1)
            if len(parts) == 2:
                hosts_dict[parts[0].strip()] = parts[1].strip()
        if hosts_dict:
            run_kwargs["extra_hosts"] = hosts_dict

    if command and command.strip():
        run_kwargs["command"] = command.strip()

    # In container: mode, remove port bindings (parent handles ports)
    if network_mode.startswith("container:"):
        run_kwargs["ports"] = None

    try:
        container = client.containers.run(**run_kwargs)
        logger.info("Created O11 container %s (image: %s)", name, image)
        return container.id
    except APIError as e:
        logger.error("Failed to create O11 container %s: %s", name, e)
        raise


def redeploy_o11_container(
    container_name: str,
    image: str | None = None,
    environment: dict | None = None,
    ports: list[dict] | None = None,
    volumes: list[dict] | None = None,
    restart_policy: str | None = None,
    command: str | None = None,
    labels: dict | None = None,
) -> str | None:
    """Redeploy an O11 container with updated configuration.
    Preserves network_mode, labels, capabilities etc. from the existing container.
    Returns new container_id.
    """
    client = _get_client()
    try:
        container = client.containers.get(container_name)
    except NotFound:
        raise RuntimeError(f"Container '{container_name}' not found")

    attrs = container.attrs or {}
    config = attrs.get("Config", {})
    host_config = attrs.get("HostConfig", {})

    old_image = config.get("Image", "")
    new_image = image if image else old_image

    # Always pull latest image on redeploy
    try:
        logger.info("Pulling latest image %s for redeploy ...", new_image)
        client.images.pull(new_image)
    except Exception as e:
        logger.warning("Failed to pull latest image %s, using local: %s", new_image, e)

    # Preserve existing container properties
    old_env = config.get("Env", [])
    labels_existing = config.get("Labels", {}) or {}
    if labels is not None:
        # Replace all traefik.* labels with the provided ones, preserve the rest.
        merged_labels = {
            k: v
            for k, v in labels_existing.items()
            if not (k.startswith("traefik.") or k.startswith("traefik-"))
        }
        for k, v in labels.items():
            merged_labels[k] = str(v)
        final_labels = merged_labels
    else:
        final_labels = dict(labels_existing)
    final_labels[COMPOSE_PROJECT_LABEL] = COMPOSE_PROJECT_VALUE
    cmd = config.get("Cmd")
    entrypoint = config.get("Entrypoint")
    hostname = config.get("Hostname", "")
    network_mode = host_config.get("NetworkMode", "")
    old_volumes = host_config.get("Binds") or []
    old_port_bindings = host_config.get("PortBindings") or {}
    old_restart = host_config.get("RestartPolicy") or {}
    cap_add = host_config.get("CapAdd") or []
    cap_drop = host_config.get("CapDrop") or []
    security_opt = host_config.get("SecurityOpt") or []
    privileged = host_config.get("Privileged", False)
    devices = host_config.get("Devices") or []

    # Build new environment
    if environment is not None:
        new_env = [
            f"{k}={v}"
            for k, v in environment.items()
            if v is not None and str(v).strip()
        ]
    else:
        new_env = old_env

    # Build new port bindings
    if ports is not None:
        new_port_bindings = {}
        for p in ports:
            host_port = int(p.get("host", 0))
            container_port = int(p.get("container", 0))
            protocol = p.get("protocol", "tcp").lower()
            if host_port > 0 and container_port > 0 and protocol in ("tcp", "udp"):
                new_port_bindings[f"{container_port}/{protocol}"] = [
                    {"HostPort": str(host_port)}
                ]
    else:
        new_port_bindings = old_port_bindings

    # Build new volume bindings
    if volumes is not None:
        new_volumes = []
        for v in volumes:
            source = v.get("source", "").strip()
            target = v.get("target", "").strip()
            mode = v.get("mode", "rw").strip()
            if source and target:
                new_volumes.append(f"{source}:{target}:{mode}")
    else:
        new_volumes = old_volumes

    # Build new restart policy
    if restart_policy is not None:
        new_restart = {"Name": restart_policy, "MaximumRetryCount": 0}
    else:
        new_restart = old_restart

    # Build new command
    if command is not None:
        new_cmd = command.strip() if command.strip() else None
    else:
        new_cmd = cmd

    was_running = container.status == "running"

    # Stop and remove old container
    if was_running:
        container.stop(timeout=10)
    container.remove()

    # Build create kwargs
    create_kwargs = {
        "image": new_image,
        "name": container_name,
        "command": new_cmd,
        "entrypoint": entrypoint,
        "environment": new_env,
        "labels": final_labels,
        "network_mode": (
            network_mode if network_mode and network_mode != "default" else None
        ),
        "volumes": new_volumes if new_volumes else None,
        "restart_policy": new_restart,
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

    if network_mode.startswith("container:"):
        create_kwargs["ports"] = {}
    else:
        create_kwargs["ports"] = new_port_bindings
        if hostname:
            create_kwargs["hostname"] = hostname

    new_container = client.containers.create(**create_kwargs)
    if was_running:
        new_container.start()

    logger.info("Redeployed O11 container %s (image: %s)", container_name, new_image)
    return new_container.id


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
            port_control = 8000

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

            # Detect network (use first non-default network, or None)
            networks = attrs.get("NetworkSettings", {}).get("Networks", {})
            detected_network = None
            for net_name in networks:
                if net_name not in ("bridge", "host", "none"):
                    detected_network = net_name
                    break

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
                    "network_name": detected_network,
                    "status": container.status,
                }
            )
    except Exception as e:
        logger.error("Failed to discover Gluetun containers: %s", e)
    return discovered
