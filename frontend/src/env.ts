function readEnvNumber(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readEnvString(key: string, fallback: string): string {
  const raw = import.meta.env[key];
  return raw === undefined || raw === "" ? fallback : raw;
}

export const FLY_AREA_CONFIG = {
  count: readEnvNumber("VITE_FLY_COUNT", 12),
  widthMm: readEnvNumber("VITE_FLY_AREA_WIDTH_MM", 120),
  depthMm: readEnvNumber("VITE_FLY_AREA_DEPTH_MM", 120),
  heightMm: readEnvNumber("VITE_FLY_AREA_HEIGHT_MM", 0),
};

// flyyt-backend (VDA5050 fly-fleet simulator) connectivity. Same-origin
// defaults so "npm run build" served by the backend container (see
// flyyt/backend/src/flyyt_backend/main.py) works with zero config; override
// for local dev when the backend/NATS run on different hosts/ports.
export const BACKEND_CONFIG = {
  apiUrl: readEnvString("VITE_FLYYT_API_URL", ""),
  natsWsUrl: readEnvString("VITE_NATS_WS_URL", "ws://localhost:8080"),
};
