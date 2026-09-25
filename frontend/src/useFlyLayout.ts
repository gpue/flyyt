import { useEffect, useState } from "react";
import { apiPath, FLY_AREA_CONFIG } from "./env";
import { EXTENT_MM, GROUND_OFFSET_MM } from "./rigMetadata";

export interface FlyInstanceData {
  id: string;
  index: number;
  position: [number, number, number];
  /** atan2(x, z) convention, matching the frontend's heading math. */
  heading: number;
}

export const FLY_GROUND_OFFSET_MM = GROUND_OFFSET_MM;
export const FLY_EXTENT_MM = EXTENT_MM;

function generateLocalLayout(config: typeof FLY_AREA_CONFIG, groundOffsetMm: number): FlyInstanceData[] {
  return Array.from({ length: config.count }, (_, index) => ({
    id: `fly-${index}`,
    index,
    position: [
      (Math.random() - 0.5) * config.widthMm,
      groundOffsetMm + Math.random() * config.heightMm,
      (Math.random() - 0.5) * config.depthMm,
    ],
    heading: Math.random() * Math.PI * 2,
  }));
}

interface RosterEntry {
  id: string;
  x: number;
  y: number;
  theta: number;
}

/**
 * flyyt-backend (if reachable) owns the fleet roster -- stable serialNumbers
 * and spawn positions, so VDA5050 identity means something across page
 * reloads (see useVda5050Nats.ts). No backend running is a completely
 * normal, fully-supported case ("local practice mode") -- this app has
 * always worked standalone and keeps working exactly the same way if the
 * fetch fails or times out.
 */
async function fetchRoster(groundOffsetMm: number): Promise<FlyInstanceData[] | null> {
  try {
    const res = await fetch(apiPath("roster"), { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const roster: RosterEntry[] = await res.json();
    if (roster.length === 0) return null;
    return roster.map((entry, index) => ({
      id: entry.id,
      index,
      // Same (x,y)->(x,z) conversion as useVda5050Nats.ts's applyPosition.
      position: [entry.x, groundOffsetMm, -entry.y],
      heading: entry.theta + Math.PI / 2,
    }));
  } catch {
    return null;
  }
}

export function useFlyLayout(): FlyInstanceData[] {
  const [flies, setFlies] = useState<FlyInstanceData[]>(() =>
    generateLocalLayout(FLY_AREA_CONFIG, FLY_GROUND_OFFSET_MM),
  );

  useEffect(() => {
    let cancelled = false;
    fetchRoster(FLY_GROUND_OFFSET_MM).then((roster) => {
      // Swaps the locally-generated layout for the backend's once it
      // arrives, rather than blocking first paint on the fetch -- normally
      // near-instant (local dev) or a fast, harmless no-op (unreachable).
      if (!cancelled && roster) setFlies(roster);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return flies;
}
