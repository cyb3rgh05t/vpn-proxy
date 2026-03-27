import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base, SessionLocal
from app.models.vpn_container import VPNContainer
from app.services import docker_service
from app.routers import auth, containers

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
                    continue
                vpn_container = VPNContainer(
                    name=info["name"],
                    vpn_provider=info["vpn_provider"],
                    vpn_type=info["vpn_type"],
                    config=info["config"],
                    port_http_proxy=info["port_http_proxy"],
                    port_shadowsocks=info["port_shadowsocks"],
                    port_control=info["port_control"],
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
        finally:
            db.close()
    except Exception as e:
        logger.warning("Auto-discovery of Gluetun containers failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    auto_discover_containers()
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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(containers.router)


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
