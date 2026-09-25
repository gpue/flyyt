import { useRef } from "react";
import { createBrain, type BrainState } from "./flyBrain";
import { createGaitState, type GaitState } from "./tripodGait";
import { FLY_GROUND_OFFSET_MM, type FlyInstanceData } from "./useFlyLayout";
import { createWingControllerState, type WingControllerState } from "./wingController";

export interface VisionState {
  /** Which other fly this one is currently tracking as "nearest visible", if any. */
  trackedFlyId: string | null;
  /** Last frame's distance to trackedFlyId — closing speed is the frame-to-frame delta of this. */
  lastDistance: number;
}

export type OperatingMode = "AUTOMATIC" | "MANUAL";
export type ConnectionState = "ONLINE" | "OFFLINE" | "CONNECTION_BROKEN" | "UNKNOWN";

export interface LiveFlyState {
  x: number;
  y: number;
  z: number;
  heading: number;
  gait: GaitState;
  brain: BrainState;
  wingController: WingControllerState;
  vision: VisionState;
  /** VDA5050 status, from flyyt-backend over NATS (useVda5050Nats.ts) — AUTOMATIC
   * (backend-driven, order-following) makes FlyInstances.tsx consume x/z/heading
   * from the backend instead of local joystick simulation; MANUAL is the opposite
   * (this fly's own local joystick/gait is authoritative). Backend-less "practice
   * mode" (no connection ever established) behaves exactly like today: MANUAL always. */
  operatingMode: OperatingMode;
  connectionState: ConnectionState;
  batteryPercent: number;
  orderId: string;
  driving: boolean;
  /** Flight mode -- true while this fly is commanded airborne (App.tsx's
   * flying/altitude UI state syncs onto whichever fly is selected). */
  flying: boolean;
  /** What live.y eases toward each frame (FlyInstances.tsx) -- ground
   * offset while grounded/landing, one of altitudeLevels.ts's levels while flying. */
  targetAltitudeMm: number;
}

export type LiveFlyPositions = Map<string, LiveFlyState>;

export function useLiveFlyState(flies: FlyInstanceData[]) {
  return useRef<LiveFlyPositions>(
    new Map(
      flies.map((fly) => [
        fly.id,
        {
          x: fly.position[0],
          y: fly.position[1],
          z: fly.position[2],
          heading: fly.heading,
          gait: createGaitState(),
          brain: createBrain(),
          wingController: createWingControllerState(),
          vision: { trackedFlyId: null, lastDistance: 0 },
          operatingMode: "MANUAL",
          connectionState: "UNKNOWN",
          batteryPercent: 100,
          orderId: "",
          driving: false,
          flying: false,
          targetAltitudeMm: FLY_GROUND_OFFSET_MM,
        },
      ]),
    ),
  );
}
