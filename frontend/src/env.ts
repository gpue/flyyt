function readEnvNumber(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const FLY_AREA_CONFIG = {
  count: readEnvNumber("VITE_FLY_COUNT", 12),
  widthMm: readEnvNumber("VITE_FLY_AREA_WIDTH_MM", 120),
  depthMm: readEnvNumber("VITE_FLY_AREA_DEPTH_MM", 120),
  heightMm: readEnvNumber("VITE_FLY_AREA_HEIGHT_MM", 0),
};
