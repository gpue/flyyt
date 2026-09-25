/**
 * Subscribes to flyyt-backend's VDA5050 NATS subjects over WebSocket
 * (`@nats-io/nats-core`'s `wsconnect` — the actively-maintained NATS JS
 * client; NOT the deprecated `nats.ws` package) and updates each fly's
 * LiveFlyState directly (the same external-mutable-ref pattern already used
 * throughout this app — CameraRig.tsx, BrainActivity.tsx — no extra store).
 *
 * Coordinate conversion (VDA5050 (x,y) -> flyyt's (x,z) ground plane):
 * flyyt_x = vda5050_x, flyyt_z = -vda5050_y (matches the nova-assets/nova-nav
 * convention of (x,y) -> three.js (x, height, -y)). Heading: flyyt's heading
 * is defined by dir = (sin(heading), cos(heading)) (established in
 * FlyInstances.tsx); working through that against the position mapping
 * above gives a constant offset, `heading = vdaTheta + PI/2` (verified: VDA
 * theta=0 means facing +x, which under x_flyyt=x/z_flyyt=-y is direction
 * (1,0) in (x,z) -> flyyt heading PI/2, matching the formula).
 *
 * This app has no built-in NATS server — point VITE_NATS_WS_URL at any NATS
 * server with a websocket listener enabled (see README), self-hosted or
 * otherwise; nothing here depends on any specific provider.
 */

import { useEffect, useRef } from "react";
import { BACKEND_CONFIG } from "../env";
import type { LiveFlyPositions, LiveFlyState } from "../useLiveFlyState";
import { parseVda5050Subject } from "./vda5050Subjects";

interface Vda5050StatePayload {
  driving?: boolean;
  operatingMode?: "AUTOMATIC" | "MANUAL";
  orderId?: string;
  mobileRobotPosition?: { x: number; y: number; theta: number };
  powerSupply?: { stateOfCharge?: number };
}

interface Vda5050ConnectionPayload {
  connectionState?: "ONLINE" | "OFFLINE" | "CONNECTION_BROKEN";
}

interface Vda5050VisualizationPayload {
  mobileRobotPosition?: { x: number; y: number; theta: number };
}

export function useVda5050Nats(livePositionsRef: React.RefObject<LiveFlyPositions>): void {
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function connect() {
      try {
        const { wsconnect } = await import("@nats-io/nats-core");
        if (cancelledRef.current) return;

        const nc = await wsconnect({ servers: BACKEND_CONFIG.natsWsUrl });
        if (cancelledRef.current) {
          await nc.close();
          return;
        }

        const sub = nc.subscribe("vda5050.>");
        (async () => {
          for await (const msg of sub) {
            if (cancelledRef.current) break;
            const parsed = parseVda5050Subject(msg.subject);
            if (!parsed) continue;

            const live = livePositionsRef.current.get(parsed.serial);
            if (!live) continue;

            let payload: unknown;
            try {
              payload = JSON.parse(new TextDecoder().decode(msg.data));
            } catch {
              continue;
            }

            if (parsed.messageType === "connection") {
              const p = payload as Vda5050ConnectionPayload;
              live.connectionState = p.connectionState ?? "UNKNOWN";
            } else if (parsed.messageType === "state") {
              const p = payload as Vda5050StatePayload;
              live.operatingMode = p.operatingMode ?? "AUTOMATIC";
              live.driving = p.driving ?? false;
              live.orderId = p.orderId ?? "";
              live.batteryPercent = p.powerSupply?.stateOfCharge ?? live.batteryPercent;
              if (live.operatingMode === "AUTOMATIC" && p.mobileRobotPosition) {
                applyPosition(live, p.mobileRobotPosition);
              }
            } else if (parsed.messageType === "visualization") {
              const p = payload as Vda5050VisualizationPayload;
              if (live.operatingMode === "AUTOMATIC" && p.mobileRobotPosition) {
                applyPosition(live, p.mobileRobotPosition);
              }
            }
          }
        })();

        return () => {
          sub.unsubscribe();
          nc.close();
        };
      } catch {
        // Backend/NATS not reachable — flies stay in local practice mode
        // (operatingMode defaults to MANUAL, joystick works exactly as
        // before this feature existed).
      }
    }

    const cleanupPromise = connect();
    return () => {
      cancelledRef.current = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [livePositionsRef]);
}

function applyPosition(live: LiveFlyState, pos: { x: number; y: number; theta: number }): void {
  live.x = pos.x;
  live.z = -pos.y;
  live.heading = pos.theta + Math.PI / 2;
}
