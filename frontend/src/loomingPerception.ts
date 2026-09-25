/**
 * "Vision": detects the nearest other fly within range/field-of-view and
 * turns (distance, closing speed, bearing) into a per-wing drive via a
 * tiny MLP trained offline (tools/train_looming_response.py) on synthetic,
 * hand-labeled data (tools/generate_looming_training_data.py) — there's no
 * real dataset for "wing flap vs. distance to another fly" in this scene,
 * so the labels come from a designed target curve, and the network is
 * trained to fit/generalize it. Same placeholder spirit as flyBrain.ts and
 * tripodGait.ts: a small stand-in with the right shape of interface, not a
 * claim of real fly-vision biology.
 *
 * Closing speed is a finite difference of distance across frames
 * (VisionState.lastDistance), not self's own velocity projected toward the
 * target — that would miss a stationary fly being approached by a MOVING
 * other fly, which is a real case now that every fly's brain/wings update
 * each frame (FlyInstances.tsx), even though only one fly is ever
 * human-driven at a time.
 */

import loomingModel from "./assets/looming-model.json";
import type { LiveFlyPositions, LiveFlyState, VisionState } from "./useLiveFlyState";

const DETECTION_RANGE_MM = loomingModel.detectionRangeMm;
const MAX_CLOSING_SPEED_MM_S = loomingModel.maxClosingSpeedMmS;
const FOV_HALF_ANGLE_RAD = loomingModel.fovHalfAngleRad;

const W1 = loomingModel.w1; // 3 x 8
const B1 = loomingModel.b1; // 8
const W2 = loomingModel.w2; // 8 x 2
const B2 = loomingModel.b2; // 2

export interface LoomingDrive {
  left: number;
  right: number;
}

const ZERO_DRIVE: LoomingDrive = { left: 0, right: 0 };

interface VisibleFly {
  id: string;
  distance: number;
  bearing: number;
}

/**
 * Nearest other fly within DETECTION_RANGE_MM and FOV_HALF_ANGLE_RAD of
 * `selfLive`'s current heading, using every fly's CURRENT position (not
 * spawn layout) since any fly can move now.
 */
function findNearestVisibleFly(
  selfId: string,
  selfLive: LiveFlyState,
  livePositions: LiveFlyPositions,
): VisibleFly | null {
  const forwardX = Math.sin(selfLive.heading);
  const forwardZ = Math.cos(selfLive.heading);
  const rightX = -Math.cos(selfLive.heading);
  const rightZ = Math.sin(selfLive.heading);

  let nearest: VisibleFly | null = null;
  for (const [otherId, otherLive] of livePositions) {
    if (otherId === selfId) continue;
    const dx = otherLive.x - selfLive.x;
    const dz = otherLive.z - selfLive.z;
    const distance = Math.hypot(dx, dz);
    if (distance > DETECTION_RANGE_MM) continue;

    const forwardComponent = dx * forwardX + dz * forwardZ;
    const rightComponent = dx * rightX + dz * rightZ;
    const bearing = Math.atan2(rightComponent, forwardComponent);
    if (Math.abs(bearing) > FOV_HALF_ANGLE_RAD) continue;

    if (!nearest || distance < nearest.distance) {
      nearest = { id: otherId, distance, bearing };
    }
  }
  return nearest;
}

function forward(x: number[], w1: number[][], b1: number[], w2: number[][], b2: number[]): number[] {
  const hidden = b1.map((bias, j) => {
    let sum = bias;
    for (let i = 0; i < x.length; i++) sum += x[i] * w1[i][j];
    return Math.tanh(sum);
  });
  return b2.map((bias, j) => {
    let sum = bias;
    for (let i = 0; i < hidden.length; i++) sum += hidden[i] * w2[i][j];
    return 1 / (1 + Math.exp(-sum));
  });
}

/**
 * Updates `selfLive.vision` (tracked-fly bookkeeping for the closing-speed
 * finite difference) and returns this frame's per-wing looming drive,
 * in [0,1] each.
 */
export function computeLoomingDrive(
  selfId: string,
  selfLive: LiveFlyState,
  livePositions: LiveFlyPositions,
  dt: number,
): LoomingDrive {
  const vision: VisionState = selfLive.vision;
  const visible = findNearestVisibleFly(selfId, selfLive, livePositions);

  if (!visible) {
    vision.trackedFlyId = null;
    return ZERO_DRIVE;
  }

  // A fresh target (or the first ever) has no prior distance to diff
  // against -- start at 0 closing speed rather than an artificial spike.
  const closingSpeed =
    vision.trackedFlyId === visible.id && dt > 0 ? (vision.lastDistance - visible.distance) / dt : 0;
  vision.trackedFlyId = visible.id;
  vision.lastDistance = visible.distance;

  const input = [
    Math.min(1, visible.distance / DETECTION_RANGE_MM),
    Math.max(-1, Math.min(1, closingSpeed / MAX_CLOSING_SPEED_MM_S)),
    Math.max(-1, Math.min(1, visible.bearing / FOV_HALF_ANGLE_RAD)),
  ];
  const [left, right] = forward(input, W1, B1, W2, B2);
  return { left, right };
}
