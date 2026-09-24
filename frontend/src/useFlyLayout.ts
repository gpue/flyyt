import { useMemo } from "react";
import flyMetadata from "./assets/fly-metadata.json";
import { FLY_AREA_CONFIG } from "./env";

export interface FlyInstanceData {
  id: string;
  index: number;
  position: [number, number, number];
}

export const FLY_GROUND_OFFSET_MM = flyMetadata.groundOffsetMm;
export const FLY_EXTENT_MM = flyMetadata.extentMm as [number, number, number];

function generateFlyLayout(
  config: typeof FLY_AREA_CONFIG,
  groundOffsetMm: number,
): FlyInstanceData[] {
  return Array.from({ length: config.count }, (_, index) => ({
    id: `fly-${index}`,
    index,
    position: [
      (Math.random() - 0.5) * config.widthMm,
      groundOffsetMm + Math.random() * config.heightMm,
      (Math.random() - 0.5) * config.depthMm,
    ],
  }));
}

export function useFlyLayout(): FlyInstanceData[] {
  // Shuffle once per mount, not per render — FLY_AREA_CONFIG/FLY_GROUND_OFFSET_MM
  // are module-scope constants, intentionally omitted from the deps array.
  return useMemo(() => generateFlyLayout(FLY_AREA_CONFIG, FLY_GROUND_OFFSET_MM), []);
}
