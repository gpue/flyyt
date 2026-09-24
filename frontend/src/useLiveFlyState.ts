import { useRef } from "react";
import { createBrain, type BrainState } from "./flyBrain";
import { createGaitState, type GaitState } from "./tripodGait";
import type { FlyInstanceData } from "./useFlyLayout";

export interface LiveFlyState {
  x: number;
  y: number;
  z: number;
  heading: number;
  gait: GaitState;
  brain: BrainState;
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
        },
      ]),
    ),
  );
}
