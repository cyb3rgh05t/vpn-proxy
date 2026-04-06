import json
import logging
import threading
import time
import requests

from app.database import SessionLocal
from app.models.app_settings import AppSettings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_settings_cache: dict | None = None
_previous_states: dict[int, dict] = (
    {}
)  # container_id -> {status, vpn_status, public_ip}
_running = False
_thread: threading.Thread | None = None
_initial_check_done = False

# Cooldown tracking
_last_notified: dict[str, float] = {}  # "container_id:event" -> timestamp

# Defaults
DEFAULT_CHECK_INTERVAL = 30  # seconds
DEFAULT_COOLDOWN_MINUTES = 60  # minutes


def _get_settings() -> dict:
    """Load Telegram notification settings from DB."""
    global _settings_cache
    try:
        db = SessionLocal()
        try:
            row = (
                db.query(AppSettings)
                .filter(AppSettings.key == "telegram_settings")
                .first()
            )
            if row and row.value:
                _settings_cache = json.loads(row.value)
                return _settings_cache or {}
        finally:
            db.close()
    except Exception as e:
        logger.debug("Failed to load telegram settings: %s", e)
    _settings_cache = None
    return {}


def _save_settings(settings: dict):
    """Save Telegram notification settings to DB."""
    global _settings_cache
    db = SessionLocal()
    try:
        row = (
            db.query(AppSettings).filter(AppSettings.key == "telegram_settings").first()
        )
        val = json.dumps(settings)
        if row:
            row.value = val
        else:
            db.add(AppSettings(key="telegram_settings", value=val))
        db.commit()
        _settings_cache = settings
    finally:
        db.close()


def get_config() -> dict:
    """Return current Telegram config (for API)."""
    s = _get_settings()
    return {
        "enabled": s.get("enabled", False),
        "bot_token": s.get("bot_token", ""),
        "chat_id": s.get("chat_id", ""),
        "notify_disconnected": s.get("notify_disconnected", True),
        "notify_unhealthy": s.get("notify_unhealthy", True),
        "notify_stopped": s.get("notify_stopped", False),
        "notify_recovered": s.get("notify_recovered", True),
        "check_interval": s.get("check_interval", DEFAULT_CHECK_INTERVAL),
        "cooldown_minutes": s.get("cooldown_minutes", DEFAULT_COOLDOWN_MINUTES),
    }


def update_config(data: dict):
    """Update Telegram config from API data."""
    current = _get_settings() or {}
    if "enabled" in data:
        current["enabled"] = bool(data["enabled"])
    if "bot_token" in data:
        current["bot_token"] = data["bot_token"]
    if "chat_id" in data:
        current["chat_id"] = data["chat_id"]
    if "notify_disconnected" in data:
        current["notify_disconnected"] = bool(data["notify_disconnected"])
    if "notify_unhealthy" in data:
        current["notify_unhealthy"] = bool(data["notify_unhealthy"])
    if "notify_stopped" in data:
        current["notify_stopped"] = bool(data["notify_stopped"])
    if "notify_recovered" in data:
        current["notify_recovered"] = bool(data["notify_recovered"])
    if "check_interval" in data:
        current["check_interval"] = max(10, int(data["check_interval"]))
    if "cooldown_minutes" in data:
        current["cooldown_minutes"] = max(1, int(data["cooldown_minutes"]))
    _save_settings(current)
    reload()


def is_configured() -> bool:
    """Check if Telegram is properly configured."""
    s = _get_settings()
    return bool(s.get("enabled") and s.get("bot_token") and s.get("chat_id"))


def send_message(text: str) -> bool:
    """Send a Telegram message. Returns True on success."""
    s = _get_settings()
    bot_token = s.get("bot_token", "")
    chat_id = s.get("chat_id", "")
    if not bot_token or not chat_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        resp = requests.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True
        logger.warning("Telegram API returned %s: %s", resp.status_code, resp.text)
        return False
    except Exception as e:
        logger.error("Failed to send Telegram message: %s", e)
        return False


def test_message(bot_token: str | None = None, chat_id: str | None = None) -> dict:
    """Send a test message showing all event templates."""
    s = _get_settings()
    token = bot_token or s.get("bot_token", "")
    cid = chat_id or s.get("chat_id", "")
    if not token or not cid:
        return {"success": False, "error": "Bot token or chat ID not configured"}
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        text = (
            "🔔 <b>VPN Proxy Manager — Test Notification</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "This is how your notifications will look:\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "⚠️ <b>VPN Disconnected</b>\n\n"
            "Container: <code>gluetun-pia-us</code>\n"
            "Provider: Private Internet Access\n"
            "Status: VPN connection lost\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "🔴 <b>Container Unhealthy</b>\n\n"
            "Container: <code>gluetun-nordvpn-de</code>\n"
            "Provider: NordVPN\n"
            "Status: Container health check failing\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "⏹ <b>Container Stopped</b>\n\n"
            "Container: <code>gluetun-surfshark-uk</code>\n"
            "Provider: Surfshark\n"
            "Status: exited\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "✅ <b>VPN Recovered</b>\n\n"
            "Container: <code>gluetun-pia-us</code>\n"
            "Provider: Private Internet Access\n"
            "IP: <code>185.213.154.42</code>\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "✅ Connection is working!"
        )
        resp = requests.post(
            url,
            json={
                "chat_id": cid,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=10,
        )
        data = resp.json()
        if data.get("ok"):
            return {"success": True}
        return {"success": False, "error": data.get("description", "Unknown error")}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _should_notify(key: str) -> bool:
    """Check cooldown for a notification key."""
    s = _get_settings()
    cooldown_seconds = s.get("cooldown_minutes", DEFAULT_COOLDOWN_MINUTES) * 60
    now = time.time()
    last = _last_notified.get(key, 0)
    if now - last < cooldown_seconds:
        return False
    _last_notified[key] = now
    return True


def _check_containers():
    """Check all containers and send notifications for state changes."""
    global _previous_states, _initial_check_done

    if not is_configured():
        return

    s = _get_settings()
    notify_disconnected = s.get("notify_disconnected", True)
    notify_unhealthy = s.get("notify_unhealthy", True)
    notify_stopped = s.get("notify_stopped", False)
    notify_recovered = s.get("notify_recovered", True)
    is_first_run = not _initial_check_done

    try:
        from app.models.vpn_container import VPNContainer
        from app.services import docker_service

        db = SessionLocal()
        try:
            containers = db.query(VPNContainer).all()
            current_states = {}

            for c in containers:
                if not c.container_id:
                    continue

                try:
                    status_info = docker_service.get_container_status(c.container_id)
                    status = status_info.get("status", "unknown")
                except Exception:
                    status = "unknown"

                vpn_status = None
                public_ip = None
                if status in ("running", "healthy", "unhealthy", "starting"):
                    try:
                        vpn_info = docker_service.get_gluetun_vpn_info(c.container_id)
                        vpn_status = vpn_info.get("vpn_status")
                        public_ip = vpn_info.get("public_ip")
                    except Exception:
                        pass

                current_states[c.id] = {
                    "name": c.name,
                    "status": status,
                    "vpn_status": vpn_status,
                    "public_ip": public_ip,
                    "provider": c.vpn_provider,
                }

            logger.debug(
                "Telegram check: %d containers, first_run=%s",
                len(current_states),
                is_first_run,
            )

            # Compare with previous states
            for cid, curr in current_states.items():
                prev = _previous_states.get(cid)
                name = curr["name"]
                provider = curr.get("provider", "unknown")

                curr_ok = (
                    curr["status"] in ("running", "healthy")
                    and curr.get("vpn_status") == "running"
                    and curr.get("public_ip")
                )

                # First time seeing this container
                if prev is None:
                    if is_first_run:
                        # On first run, notify for containers already in bad state
                        if (
                            notify_disconnected
                            and curr["status"] in ("running", "healthy")
                            and not curr_ok
                        ):
                            key = f"{cid}:disconnected"
                            if _should_notify(key):
                                logger.info(
                                    "Notifying: %s already disconnected on startup",
                                    name,
                                )
                                send_message(
                                    f"⚠️ <b>VPN Disconnected</b>\n\n"
                                    f"Container: <code>{name}</code>\n"
                                    f"Provider: {provider}\n"
                                    f"Status: VPN connection lost"
                                )
                        if notify_unhealthy and curr["status"] == "unhealthy":
                            key = f"{cid}:unhealthy"
                            if _should_notify(key):
                                logger.info(
                                    "Notifying: %s already unhealthy on startup", name
                                )
                                send_message(
                                    f"🔴 <b>Container Unhealthy</b>\n\n"
                                    f"Container: <code>{name}</code>\n"
                                    f"Provider: {provider}\n"
                                    f"Status: Container health check failing"
                                )
                        if notify_stopped and curr["status"] in (
                            "exited",
                            "dead",
                            "removed",
                        ):
                            key = f"{cid}:stopped"
                            if _should_notify(key):
                                logger.info(
                                    "Notifying: %s already stopped on startup", name
                                )
                                send_message(
                                    f"⏹ <b>Container Stopped</b>\n\n"
                                    f"Container: <code>{name}</code>\n"
                                    f"Provider: {provider}\n"
                                    f"Status: {curr['status']}"
                                )
                    continue

                prev_ok = (
                    prev["status"] in ("running", "healthy")
                    and prev.get("vpn_status") == "running"
                    and prev.get("public_ip")
                )

                # Disconnected (running but no VPN/IP)
                if (
                    notify_disconnected
                    and curr["status"] in ("running", "healthy")
                    and (
                        not curr.get("vpn_status")
                        or curr["vpn_status"] != "running"
                        or not curr.get("public_ip")
                    )
                    and prev_ok
                ):
                    key = f"{cid}:disconnected"
                    if _should_notify(key):
                        send_message(
                            f"⚠️ <b>VPN Disconnected</b>\n\n"
                            f"Container: <code>{name}</code>\n"
                            f"Provider: {provider}\n"
                            f"Status: VPN connection lost"
                        )

                # Unhealthy
                if (
                    notify_unhealthy
                    and curr["status"] == "unhealthy"
                    and prev["status"] != "unhealthy"
                ):
                    key = f"{cid}:unhealthy"
                    if _should_notify(key):
                        send_message(
                            f"🔴 <b>Container Unhealthy</b>\n\n"
                            f"Container: <code>{name}</code>\n"
                            f"Provider: {provider}\n"
                            f"Status: Container health check failing"
                        )

                # Stopped
                if (
                    notify_stopped
                    and curr["status"] in ("exited", "dead", "removed")
                    and prev["status"] not in ("exited", "dead", "removed")
                ):
                    key = f"{cid}:stopped"
                    if _should_notify(key):
                        send_message(
                            f"⏹ <b>Container Stopped</b>\n\n"
                            f"Container: <code>{name}</code>\n"
                            f"Provider: {provider}\n"
                            f"Status: {curr['status']}"
                        )

                # Recovered
                if notify_recovered and curr_ok and not prev_ok:
                    key = f"{cid}:recovered"
                    if _should_notify(key):
                        send_message(
                            f"✅ <b>VPN Recovered</b>\n\n"
                            f"Container: <code>{name}</code>\n"
                            f"Provider: {provider}\n"
                            f"IP: <code>{curr.get('public_ip', 'N/A')}</code>"
                        )

            _previous_states = current_states
            _initial_check_done = True
        finally:
            db.close()
    except Exception as e:
        logger.error("Telegram notification check failed: %s", e)


def _run_loop():
    """Background loop that periodically checks container states."""
    global _running
    logger.info("Telegram notification checker started")
    # Wait a bit on startup to let containers populate
    time.sleep(15)
    while _running:
        try:
            _check_containers()
        except Exception as e:
            logger.error("Notification loop error: %s", e)
        s = _get_settings()
        interval = s.get("check_interval", DEFAULT_CHECK_INTERVAL)
        time.sleep(max(10, interval))


def start():
    """Start the background notification checker."""
    global _running, _thread
    if _running:
        return
    if not is_configured():
        logger.info(
            "Telegram notifications not configured, skipping background checker"
        )
        return
    _running = True
    _thread = threading.Thread(target=_run_loop, daemon=True, name="telegram-notifier")
    _thread.start()


def stop():
    """Stop the background notification checker."""
    global _running, _thread
    _running = False
    _thread = None


def reload():
    """Reload settings and restart checker if needed."""
    global _previous_states, _initial_check_done
    stop()
    _previous_states = {}
    _initial_check_done = False
    _get_settings()
    if is_configured():
        start()
