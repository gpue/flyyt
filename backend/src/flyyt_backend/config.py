"""Settings, mirroring vda5050-sim's config.py's shape/env-var conventions
so this deploys the same way (same TRANSPORT/NATS_BROKER/VDA5050_PREFIX/
BASE_PATH names) -- but NATS-only (no MQTT standalone mode) and tuned to
flyyt's own scale: flies are ~4mm long on a ~120mm ground area, not meter-
scale wheeled AGVs, so speed/coordinate units are millimeters, not meters,
and default speeds match FlyInstances.tsx's existing MAX_FORWARD_SPEED_MM_S.
"""

from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    nats_broker: str = Field(
        default="nats://localhost:4222",
        validation_alias=AliasChoices("NATS_BROKER", "NATS_URL"),
    )
    vda5050_prefix: str = "vda5050.v3"

    fleet_config_path: str = "fleet.default.yaml"

    # Publish cadences (Hz) -- same defaults as vda5050-sim.
    state_hz: float = 1.0
    visualization_hz: float = 2.0
    connection_heartbeat_s: float = 2.0

    # Movement/order-processing tick.
    tick_s: float = 0.1
    # Simulated linear travel speed (mm/s) when no per-fly override is set --
    # matches FlyInstances.tsx's MAX_FORWARD_SPEED_MM_S.
    default_speed_mm_s: float = 18.0
    # Simulated angular travel speed (rad/s) -- matches
    # FlyInstances.tsx's MAX_TURN_RATE_RAD_S.
    default_angular_speed_rad_s: float = 2.5
    # Proactively set newBaseRequest once remaining released nodes drop to/
    # below this count (vda5050-sim's own horizon-extension trigger).
    horizon_threshold_nodes: int = 2

    base_path: str = ""
    port: int = 8000
    # Used to build the mapDownloadLink instant-action parameter -- must be
    # reachable by whatever's consuming it (usually this same server, since
    # /map is served here too). Override in deployment (e.g. the app's
    # public ingress URL); localhost is fine for local dev.
    public_base_url: str = "http://localhost:8000"
    # Absolute path to the built frontend (npm run build's dist/) to serve
    # as static files. Empty (default) makes main.py fall back to a path
    # relative to this installed package's own location, which only works
    # when running from the source tree (local dev, `uv run uvicorn`) -- the
    # Dockerfile sets this explicitly instead, since once installed as a
    # package (site-packages) that relative-to-__file__ trick no longer
    # points at a real checkout.
    frontend_dist_path: str = ""


def get_settings() -> Settings:
    return Settings()
