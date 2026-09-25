"""flyyt-backend: a VDA5050 fly-fleet simulator, same shape/deploy pattern
as vda5050-sim but for flyyt's fly-scale robots. Fully self-contained --
only depends on a plain public NATS server (e.g. `docker run nats`) and the
open VDA5050 spec; nothing here requires any Wandelbots-internal service.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from flyyt_backend.config import get_settings
from flyyt_backend.fleet import Fleet, build_fly_configs, load_fleet_layout
from flyyt_backend.map_fanout import broadcast_map
from flyyt_backend.map_store import MapData, MapStore
from flyyt_backend.transport import NatsTransport

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("flyyt_backend")

settings = get_settings()
map_store = MapStore()
state: dict = {"fleet": None, "transport": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    transport = NatsTransport(settings.nats_broker, settings.vda5050_prefix)
    await transport.connect()
    fleet = Fleet(settings, transport)
    layout = load_fleet_layout(settings.fleet_config_path)
    await fleet.start(build_fly_configs(layout))
    state["fleet"] = fleet
    state["transport"] = transport
    logger.info("flyyt-backend started: %d flies, nats=%s", len(fleet.runtimes), settings.nats_broker)
    yield
    await fleet.stop()
    await transport.close()


app = FastAPI(title="flyyt-backend", lifespan=lifespan)

# Permissive by design: this is a read-mostly simulator API with no auth or
# secrets, and needs to work both same-origin (the packaged Docker image
# serves frontend+API together) and cross-origin (local dev: frontend on
# :5173/5174, backend on :8000; or a split self-hosted deployment).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(f"{settings.base_path}/health")
def health():
    return {"status": "ok"}


@app.get(f"{settings.base_path}/fleet")
def get_fleet():
    fleet: Fleet = state["fleet"]
    return fleet.snapshot()


@app.get(f"{settings.base_path}/roster")
def get_roster():
    """The stable fly-identity + spawn-position roster the frontend fetches
    once on startup instead of inventing random local IDs/positions (see
    useFlyLayout.ts) -- needed so VDA5050 serialNumbers stay meaningful
    across page reloads."""
    fleet: Fleet = state["fleet"]
    return fleet.roster()


@app.get(f"{settings.base_path}/map", response_model=MapData)
def get_map():
    return map_store.get()


@app.post(f"{settings.base_path}/map", response_model=MapData)
async def set_map(data: MapData):
    fleet: Fleet = state["fleet"]
    transport: NatsTransport = state["transport"]
    map_store.set(data)
    download_link = f"{settings.public_base_url}{settings.base_path}/map"
    await broadcast_map(fleet, transport, data, download_link)
    return map_store.get()


@app.post(f"{settings.base_path}/fly/{{serial}}/manual")
def set_manual(serial: str, manual: bool):
    """The frontend calls this when the local joystick engages/releases a
    fly, so the backend's operatingMode (AUTOMATIC while order-following,
    MANUAL while locally driven) reflects reality -- see fly.py's
    set_manual_mode."""
    fleet: Fleet = state["fleet"]
    runtime = fleet.runtimes.get(serial)
    if runtime is None:
        raise HTTPException(status_code=404, detail="fly not found")
    runtime.fly.set_manual_mode(manual)
    return {"id": serial, "operatingMode": runtime.fly.operating_mode.value}


# Serve the built frontend (npm run build -> frontend/dist) if present, so
# the same container serves both the API and the UI -- one deployable image,
# matching nova-nav's Dockerfile shape (not vda5050-sim's, which is API-only).
# settings.frontend_dist_path (set explicitly by the Dockerfile) takes
# priority; the __file__-relative fallback only resolves correctly when
# running from the source tree (local dev), not once installed as a package.
_frontend_dist = (
    Path(settings.frontend_dist_path)
    if settings.frontend_dist_path
    else Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
)
if _frontend_dist.is_dir():
    app.mount(f"{settings.base_path}/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get(f"{settings.base_path}/{{full_path:path}}")
    def spa(full_path: str):
        candidate = _frontend_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
