import gzip
import json
import logging
import time
import threading
import requests
import websocket

logger = logging.getLogger(__name__)

_token: str | None = None
_token_time: float = 0
_lock = threading.Lock()
_credentials: dict = {}

# Per-instance token cache: instance_id -> (token, timestamp)
_instance_tokens: dict[str, tuple[str, float]] = {}
_instance_lock = threading.Lock()

# Token refresh interval (23 hours – tokens expire at ~24h)
TOKEN_TTL = 23 * 3600


def _load_credentials() -> dict:
    """Load O11 credentials from DB (first instance), falling back to env vars."""
    global _credentials
    try:
        from app.database import SessionLocal
        from app.models.app_settings import AppSettings

        db = SessionLocal()
        try:
            # Try new multi-instance format first
            row = (
                db.query(AppSettings).filter(AppSettings.key == "o11_instances").first()
            )
            if row and row.value:
                try:
                    instances = json.loads(row.value)
                    if instances:
                        inst = instances[0]
                        _credentials = {
                            "o11_url": inst.get("url", ""),
                            "o11_username": inst.get("username", ""),
                            "o11_password": inst.get("password", ""),
                        }
                        return _credentials
                except Exception:
                    pass

            # Fallback to legacy single-instance keys
            rows = (
                db.query(AppSettings)
                .filter(
                    AppSettings.key.in_(["o11_url", "o11_username", "o11_password"])
                )
                .all()
            )
            creds = {r.key: r.value for r in rows}
            if (
                creds.get("o11_url")
                and creds.get("o11_username")
                and creds.get("o11_password")
            ):
                _credentials = creds
                return creds
        finally:
            db.close()
    except Exception:
        pass

    # Fallback to env vars
    from app.config import settings as cfg

    _credentials = {
        "o11_url": cfg.O11_URL,
        "o11_username": cfg.O11_USERNAME,
        "o11_password": cfg.O11_PASSWORD,
    }
    return _credentials


def _get_creds() -> dict:
    if _credentials.get("o11_url"):
        return _credentials
    return _load_credentials()


def _get_base_url(url_override: str | None = None) -> str:
    if url_override:
        return url_override.rstrip("/")
    creds = _get_creds()
    url = (creds.get("o11_url") or "").rstrip("/")
    if not url:
        raise RuntimeError("O11_URL is not configured")
    return url


def _login(
    url: str | None = None, username: str | None = None, password: str | None = None
) -> str:
    """Authenticate against the O11 panel and return a JWT token."""
    global _token, _token_time
    base = _get_base_url(url)
    if not username:
        creds = _get_creds()
        username = creds.get("o11_username")
        password = creds.get("o11_password")
    resp = requests.post(
        f"{base}/api/login",
        json={"username": username, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    tok = data.get("Token", "")
    if not tok:
        raise RuntimeError("O11 login returned no token")
    # Only cache token when using default credentials
    if not url:
        _token = tok
        _token_time = time.time()
    return tok


def _get_token() -> str:
    """Return a cached token, refreshing if needed."""
    global _token, _token_time
    with _lock:
        if _token and (time.time() - _token_time) < TOKEN_TTL:
            return _token
        tok = _login()
        _token = tok
        _token_time = time.time()
        return tok


def _ws_request(action: str, extra: dict | None = None) -> dict:
    """Open a WebSocket, send one action, receive the gzip-compressed response."""
    token = _get_token()
    base = _get_base_url()
    ws_url = base.replace("http://", "ws://").replace("https://", "wss://") + "/ws"

    ws = websocket.create_connection(
        ws_url, timeout=10, header={"Authorization": token}
    )
    try:
        payload: dict = {"Action": action}
        if extra:
            payload.update(extra)
        ws.send(json.dumps(payload))
        _opcode, data = ws.recv_data()
    finally:
        ws.close()

    if not data:
        return {}
    try:
        decompressed = gzip.decompress(data)
        return json.loads(decompressed.decode("utf-8"))
    except Exception:
        return json.loads(data.decode("utf-8"))


# --- Per-instance methods ---


def _get_instance_token(
    instance_id: str, url: str, username: str, password: str
) -> str:
    """Return a cached token for a specific instance, refreshing if needed."""
    with _instance_lock:
        cached = _instance_tokens.get(instance_id)
        if cached:
            tok, ts = cached
            if tok and (time.time() - ts) < TOKEN_TTL:
                return tok
        tok = _login(url, username, password)
        _instance_tokens[instance_id] = (tok, time.time())
        return tok


def _ws_request_for_instance(
    instance_id: str,
    url: str,
    username: str,
    password: str,
    action: str,
    extra: dict | None = None,
) -> dict:
    """WebSocket request against a specific O11 instance."""
    token = _get_instance_token(instance_id, url, username, password)
    base = url.rstrip("/")
    ws_url = base.replace("http://", "ws://").replace("https://", "wss://") + "/ws"

    ws = websocket.create_connection(
        ws_url, timeout=10, header={"Authorization": token}
    )
    try:
        payload: dict = {"Action": action}
        if extra:
            payload.update(extra)
        ws.send(json.dumps(payload))
        _opcode, data = ws.recv_data()
    finally:
        ws.close()

    if not data:
        return {}
    try:
        decompressed = gzip.decompress(data)
        return json.loads(decompressed.decode("utf-8"))
    except Exception:
        return json.loads(data.decode("utf-8"))


def get_monitoring_for_instance(
    instance_id: str, url: str, username: str, password: str
) -> dict:
    """Fetch monitoring data for a specific instance."""
    return _ws_request_for_instance(instance_id, url, username, password, "monitoring")


def get_network_usage_for_instance(
    instance_id: str,
    url: str,
    username: str,
    password: str,
    provider_id: str,
) -> dict:
    """Fetch network-usage data for a specific instance."""
    return _ws_request_for_instance(
        instance_id,
        url,
        username,
        password,
        "networkstatus",
        {"ProviderId": provider_id},
    )


def get_proxy_count_for_instance(
    instance_id: str,
    url: str,
    username: str,
    password: str,
    provider_id: str,
) -> int:
    """Return the number of unique active proxy URLs for a specific instance."""
    data = get_network_usage_for_instance(
        instance_id, url, username, password, provider_id
    )
    usage = data.get("Usage", {})
    unique_urls = set()
    for cat_data in usage.values():
        proxy = cat_data.get("Proxy", {})
        unique_urls.update(proxy.keys())
    return len(unique_urls)


def reload_credentials():
    """Force reload credentials from the DB (called after settings change)."""
    global _token, _token_time, _credentials
    with _lock:
        _credentials = {}
        _token = None
        _token_time = 0
    with _instance_lock:
        _instance_tokens.clear()
    _load_credentials()


def is_configured() -> bool:
    """Return True if O11 monitoring credentials are set."""
    creds = _get_creds()
    return bool(
        creds.get("o11_url") and creds.get("o11_username") and creds.get("o11_password")
    )


def test_connection(url: str, username: str, password: str):
    """Test connection to the O11 panel. Raises on failure."""
    url = url.rstrip("/")
    tok = _login(url, username, password)
    ws_url = url.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
    ws = websocket.create_connection(ws_url, timeout=10, header={"Authorization": tok})
    try:
        ws.send(json.dumps({"Action": "monitoring"}))
        _opcode, data = ws.recv_data()
    finally:
        ws.close()
    if not data:
        raise RuntimeError("No data received from O11")


def get_monitoring() -> dict:
    """Fetch overall monitoring data (all readers + system stats)."""
    return _ws_request("monitoring")


def get_network_usage(provider_id: str) -> dict:
    """Fetch network-usage / proxy data for a provider."""
    return _ws_request("networkstatus", {"ProviderId": provider_id})


def get_proxy_count(provider_id: str) -> int:
    """Return the number of unique active proxy URLs for a provider."""
    data = _ws_request("networkstatus", {"ProviderId": provider_id})
    usage = data.get("Usage", {})
    unique_urls = set()
    for cat_data in usage.values():
        proxy = cat_data.get("Proxy", {})
        unique_urls.update(proxy.keys())
    return len(unique_urls)
