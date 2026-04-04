import logging
import sys


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
    """Colored formatter for uvicorn access logs."""

    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()

        # Color HTTP status codes
        if "HTTP" in msg:
            # Color status codes
            for code_range, color in [
                ("200", Colors.GREEN),
                ("201", Colors.GREEN),
                ("204", Colors.GREEN),
                ("301", Colors.CYAN),
                ("302", Colors.CYAN),
                ("304", Colors.CYAN),
                ("400", Colors.YELLOW),
                ("401", Colors.YELLOW),
                ("403", Colors.YELLOW),
                ("404", Colors.YELLOW),
                ("500", Colors.BRIGHT_RED),
                ("502", Colors.BRIGHT_RED),
                ("503", Colors.BRIGHT_RED),
            ]:
                status_str = f" {code_range} "
                if status_str in msg:
                    msg = msg.replace(
                        status_str,
                        f" {color}{Colors.BOLD}{code_range}{Colors.RESET} ",
                    )
                    break

        level = record.levelname
        color = LEVEL_COLORS.get(level, Colors.RESET)
        icon = LEVEL_ICONS.get(level, "●")

        return f"{color}[ACC] {'ACCESS':<8}{Colors.RESET} {Colors.DIM}uvicorn{Colors.RESET} {Colors.GRAY}|{Colors.RESET} {msg}"


BANNER = f"""{Colors.CYAN}{Colors.BOLD}
 +================================================+
 |                                                |
 |          VPN Proxy Manager v1.0.0              |
 |                                                |
 +================================================+{Colors.RESET}
"""


def setup_logging(level: int = logging.INFO) -> None:
    """Configure colored logging for the entire application."""
    # Root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers
    root.handlers.clear()

    # Console handler with our colored formatter
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(ColoredFormatter())
    root.addHandler(console)

    # Uvicorn access log gets its own formatter
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_handler = logging.StreamHandler(sys.stdout)
    access_handler.setFormatter(UvicornAccessFormatter())
    access_logger.addHandler(access_handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def print_banner() -> None:
    """Print the startup banner."""
    print(BANNER)
