import { useEffect, useState } from "react";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions, LiveFlyState } from "./useLiveFlyState";

export type StatusSnapshot = Map<string, Pick<LiveFlyState, "driving" | "operatingMode" | "batteryPercent" | "connectionState">>;

/** Snapshots the fly list's status readout periodically into React state --
 * status lives in livePositionsRef (mutated imperatively by
 * useVda5050Nats.ts, no React state of its own by design, same as
 * everywhere else in this app), so a plain DOM component like this one
 * needs its own light poll to notice changes; matches vda5050-sim's own
 * status UI's polling approach. The snapshot is built here (an effect
 * callback, not render) so the render itself only ever reads state, never
 * the ref directly. */
export function useStatusSnapshot(flies: FlyInstanceData[], livePositionsRef: React.RefObject<LiveFlyPositions>): StatusSnapshot {
  const [snapshot, setSnapshot] = useState<StatusSnapshot>(() => new Map());
  useEffect(() => {
    const id = setInterval(() => {
      const next: StatusSnapshot = new Map();
      for (const fly of flies) {
        const live = livePositionsRef.current.get(fly.id);
        if (live) {
          next.set(fly.id, {
            driving: live.driving,
            operatingMode: live.operatingMode,
            batteryPercent: live.batteryPercent,
            connectionState: live.connectionState,
          });
        }
      }
      setSnapshot(next);
    }, 500);
    return () => clearInterval(id);
  }, [flies, livePositionsRef]);
  return snapshot;
}
