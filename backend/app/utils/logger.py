import logging
import os
import re
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler


# ANSI color codes
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    # Foreground
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    GRAY = "\033[90m"

    # Bright
    BRIGHT_RED = "\033[91m"
    BRIGHT_GREEN = "\033[92m"
    BRIGHT_YELLOW = "\033[93m"
    BRIGHT_CYAN = "\033[96m"


LEVEL_COLORS = {
    "DEBUG": Colors.GRAY,
    "INFO": Colors.BRIGHT_GREEN,
    "WARNING": Colors.BRIGHT_YELLOW,
    "ERROR": Colors.BRIGHT_RED,
    "CRITICAL": Colors.BOLD + Colors.BRIGHT_RED,
}

LEVEL_ICONS = {
    "DEBUG": "[DBG]",
    "INFO": "[INF]",
    "WARNING": "[WRN]",
    "ERROR": "[ERR]",
    "CRITICAL": "[CRT]",
}


class ColoredFormatter(logging.Formatter):
    """Custom colored formatter for console output."""

    def format(self, record: logging.LogRecord) -> str:
        level = record.levelname
        color = LEVEL_COLORS.get(level, Colors.RESET)
        icon = LEVEL_ICONS.get(level, "●")

        # Shorten logger name for cleaner output
        name = record.name
        if name.startswith("app."):
            name = name[4:]
        # Truncate long names
        if len(name) > 28:
            name = "..." + name[-25:]

        # Color the level tag
        level_tag = f"{color}{icon} {level:<8}{Colors.RESET}"

        # Dim the logger name
        name_tag = f"{Colors.DIM}{name}{Colors.RESET}"

        # Message
        msg = record.getMessage()

        # Format: [LVL] LEVEL    logger.name  | message
        formatted = f"{level_tag} {name_tag} {Colors.GRAY}|{Colors.RESET} {msg}"

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            formatted += (
                f"\n{Colors.RED}{self.formatException(record.exc_info)}{Colors.RESET}"
            )

        return formatted


class UvicornAccessFormatter(logging.Formatter):
    """Colored formatter for uvicorn access logs - compact one-line format."""

    # Regex to parse uvicorn access log: IP:PORT - "METHOD /path HTTP/x.x" STATUS
    _ACCESS_RE = re.compile(
        r'(?P<ip>[\d.]+):\d+\s+-\s+"(?P<method>\w+)\s+(?P<path>\S+)\s+HTTP/[\d.]+"\s+(?P<status>\d+)'
    )

    _METHOD_COLORS = {
        "GET": Colors.GREEN,
        "POST": Colors.CYAN,
        "PUT": Colors.YELLOW,
        "PATCH": Colors.YELLOW,
        "DELETE": Colors.RED,
    }

    def _status_color(self, code: int) -> str:
        if code < 300:
            return Colors.GREEN
        if code < 400:
            return Colors.CYAN
        if code < 500:
            return Colors.YELLOW
        return Colors.BRIGHT_RED

    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        m = self._ACCESS_RE.search(msg)
        if not m:
            return f"{Colors.DIM}[ACC]{Colors.RESET} {msg}"

        ip = m.group("ip")
        method = m.group("method")
        path = m.group("path")
        status = int(m.group("status"))

        mc = self._METHOD_COLORS.get(method, Colors.WHITE)
        sc = self._status_color(status)

        return (
            f"{Colors.DIM}[ACC]{Colors.RESET} "
            f"{mc}{method:<6}{Colors.RESET} "
            f"{sc}{Colors.BOLD}{status}{Colors.RESET} "
            f"{Colors.WHITE}{path}{Colors.RESET} "
            f"{Colors.DIM}({ip}){Colors.RESET}"
        )


BANNER = f"""{Colors.CYAN}{Colors.BOLD}
 +================================================+
 |                                                |
 |          VPN Proxy Manager v1.0.0              |
 |                                                |
 +================================================+{Colors.RESET}
"""


class FileFormatter(logging.Formatter):
    """Plain text formatter for log files (no ANSI colors)."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        level = record.levelname
        name = record.name
        if name.startswith("app."):
            name = name[4:]
        msg = record.getMessage()
        line = f"{ts} [{level:<8}] {name} | {msg}"
        if record.exc_info and record.exc_info[0] is not None:
            line += f"\n{self.formatException(record.exc_info)}"
        return line


class FileAccessFormatter(logging.Formatter):
    """Plain text formatter for access log files (no ANSI colors)."""

    _ACCESS_RE = re.compile(
        r'(?P<ip>[\d.]+):\d+\s+-\s+"(?P<method>\w+)\s+(?P<path>\S+)\s+HTTP/[\d.]+"\s+(?P<status>\d+)'
    )

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        msg = record.getMessage()
        m = self._ACCESS_RE.search(msg)
        if m:
            return f"{ts} [ACCESS  ] {m.group('method'):<6} {m.group('status')} {m.group('path')} ({m.group('ip')})"
        return f"{ts} [ACCESS  ] {msg}"


def setup_logging(level: int = logging.INFO) -> None:
    """Configure colored logging for the entire application."""
    from app.config import settings

    log_dir = os.path.join(os.path.abspath(settings.DATA_DIR), "logs")
    os.makedirs(log_dir, exist_ok=True)

    # Root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers
    root.handlers.clear()

    # --- Console handler (colored) ---
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(ColoredFormatter())
    root.addHandler(console)

    # --- File handler (plain text, rotating) ---
    app_log = os.path.join(log_dir, "vpn-proxy.log")
    file_handler = RotatingFileHandler(
        app_log, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(FileFormatter())
    root.addHandler(file_handler)

    # --- Uvicorn access log (console, colored) ---
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_console = logging.StreamHandler(sys.stdout)
    access_console.setFormatter(UvicornAccessFormatter())
    access_logger.addHandler(access_console)

    # --- Uvicorn access log (file, plain) ---
    access_file = RotatingFileHandler(
        app_log, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    access_file.setFormatter(FileAccessFormatter())
    access_logger.addHandler(access_file)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def print_banner() -> None:
    """Print the startup banner."""
    print(BANNER)
