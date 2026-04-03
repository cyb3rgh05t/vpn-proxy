import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base, SessionLocal
from app.models.vpn_container import VPNContainer
from app.models.o11_container import O11Container
from app.models.api_key import APIKey
from app.models.app_settings import AppSettings
from app.services import docker_service
from app.routers import (
    auth,
    containers,
    system,
    api_keys as api_keys_router,
    monitoring,
    settings as settings_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")


def auto_discover_containers():
    """Import existing Gluetun containers on startup."""
    try:
        discovered = docker_service.discover_gluetun_containers()
        if not discovered:
            return
        db = SessionLocal()
        try:
            imported = 0
            for info in discovered:
                existing = (
                    db.query(VPNContainer)
                    .filter(
                        (VPNContainer.container_id == info["container_id"])
                        | (VPNContainer.name == info["name"])
                    )
                    .first()
                )
                if existing:
                    if existing.container_id != info["container_id"]:
                        existing.container_id = info["container_id"]
                        existing.status = info["status"]
                        db.commit()
                    # Update network_name if not yet set
                    if not existing.network_name and info.get("network_name"):
                        existing.network_name = info["network_name"]
                        db.commit()
                    continue
                vpn_container = VPNContainer(
                    name=info["name"],
                    vpn_provider=info["vpn_provider"],
                    vpn_type=info["vpn_type"],
                    config=info["config"],
                    port_http_proxy=info["port_http_proxy"],
                    port_shadowsocks=info["port_shadowsocks"],
                    port_control=info["port_control"],
                    network_name=info.get("network_name"),
                    container_id=info["container_id"],
                    status=info["status"],
                )
                db.add(vpn_container)
                db.commit()
                imported += 1
            if imported > 0:
                logger.info("Auto-imported %d existing Gluetun containers.", imported)
            else:
                logger.info(
                    "Found %d Gluetun containers, all already tracked.", len(discovered)
                )

            # Fix legacy port_control=8001 entries
            fixed = (
                db.query(VPNContainer)
                .filter(VPNContainer.port_control == 8001)
                .update({VPNContainer.port_control: 8000})
            )
            if fixed:
                db.commit()
                logger.info("Fixed %d containers with port_control 8001 → 8000", fixed)
        finally:
            db.close()
    except Exception as e:
        logger.warning("Auto-discovery of Gluetun containers failed: %s", e)


def auto_discover_o11_containers():
    """Import existing O11 containers (labelled managed-by=vpn-proxy-o11) on startup."""
    try:
        all_containers = docker_service.list_all_docker_containers()
        o11_containers = [
            c
            for c in all_containers
            if c.get("labels", {}).get("managed-by") == "vpn-proxy-o11"
        ]
        if not o11_containers:
            return
        db = SessionLocal()
        try:
            imported = 0
            for info in o11_containers:
                existing = (
                    db.query(O11Container)
                    .filter(O11Container.name == info["name"])
                    .first()
                )
                if existing:
                    # Update container_id if changed (e.g. recreated)
                    if existing.container_id != info.get("id"):
                        existing.container_id = info.get("id")
                        db.commit()
                    continue
                record = O11Container(
                    name=info["name"],
                    image=info.get("image", ""),
                    network_mode=info.get("network_mode", ""),
                    container_id=info.get("id"),
                    status=info.get("status", "unknown"),
                )
                db.add(record)
                db.commit()
                imported += 1
            if imported > 0:
                logger.info("Auto-imported %d existing O11 containers.", imported)
            else:
                logger.info(
                    "Found %d O11 containers, all already tracked.", len(o11_containers)
                )
        finally:
            db.close()
    except Exception as e:
        logger.warning("Auto-discovery of O11 containers failed: %s", e)


def run_migrations():
    """Add missing columns to existing tables."""
    import sqlalchemy

    with engine.connect() as conn:
        inspector = sqlalchemy.inspect(engine)
        if "vpn_containers" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("vpn_containers")]
            if "extra_ports" not in columns:
                conn.execute(
                    sqlalchemy.text(
                        "ALTER TABLE vpn_containers ADD COLUMN extra_ports JSON DEFAULT '[]'"
                    )
                )
                conn.commit()
                logger.info("Migrated: added 'extra_ports' column to vpn_containers.")
            if "description" not in columns:
                conn.execute(
                    sqlalchemy.text(
                        "ALTER TABLE vpn_containers ADD COLUMN description VARCHAR(500)"
                    )
                )
                conn.commit()
                logger.info("Migrated: added 'description' column to vpn_containers.")
            if "network_name" not in columns:
                conn.execute(
                    sqlalchemy.text(
                        "ALTER TABLE vpn_containers ADD COLUMN network_name VARCHAR(150)"
                    )
                )
                conn.commit()
                logger.info("Migrated: added 'network_name' column to vpn_containers.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    run_migrations()
    auto_discover_containers()
    auto_discover_o11_containers()
    logger.info("VPN Proxy Manager started.")
    yield
    logger.info("VPN Proxy Manager shutting down.")


app = FastAPI(
    title="VPN Proxy Manager",
    description="Gluetun VPN Container Manager",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(containers.router)
app.include_router(system.router)
app.include_router(api_keys_router.router)
app.include_router(monitoring.router)
app.include_router(settings_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve built frontend in production (Docker)
if os.path.isdir(STATIC_DIR):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(STATIC_DIR, "assets")),
        name="static-assets",
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """SPA fallback: serve index.html for all non-API routes."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
