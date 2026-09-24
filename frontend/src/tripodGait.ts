import { LEGS, legJointName, type LegName } from "./rigMetadata";

/**
 * A lightweight, client-side procedural walking gait. This is NOT FlyGym's
 * own biomechanical control — it's a simplified alternating-tripod sinusoid
 * driving the same real joint set FlyGym uses (see rigMetadata.ts), so a
 * future real-FlyGym-driven controller (physics-computed joint trajectories,
 * streamed from a backend) can be swapped in later without touching the rig
 * export or rendering code — only this module's `stepGait` would change.
 */

export interface GaitCommand {
  /** mm/s, +forward / -backward along the fly's current heading. */
  forwardSpeed: number;
  /** rad/s, +left / -right. */
  turnRate: number;
}

export interface GaitState {
  phase: number;
  jointAngles: Record<string, number>;
}

const TRIPOD_GROUP_B: LegName[] = ["rf", "lm", "rh"]; // offset by PI from group A

const STRIDE_LENGTH_MM = 2; // body advances roughly this far per gait cycle
const TURN_SPEED_EQUIV_MM = 2; // how much turning alone still cycles the legs
const SWING_AMPLITUDE = 0.5; // radians, ThC_pitch fore/aft
const LIFT_AMPLITUDE = 0.35; // radians, CTr_pitch / FTi_pitch during swing
const TURN_YAW_GAIN = 0.5; // ThC_yaw bias from turnRate, opposite sign per side

export function createGaitState(): GaitState {
  return { phase: 0, jointAngles: {} };
}

export function stepGait(state: GaitState, command: GaitCommand, dt: number): void {
  const direction = command.forwardSpeed !== 0 ? Math.sign(command.forwardSpeed) : 1;
  const effectiveSpeed = Math.abs(command.forwardSpeed) + Math.abs(command.turnRate) * TURN_SPEED_EQUIV_MM;
  state.phase += direction * (effectiveSpeed / STRIDE_LENGTH_MM) * Math.PI * 2 * dt;

  for (const leg of Object.keys(LEGS) as LegName[]) {
    const legPhase = state.phase + (TRIPOD_GROUP_B.includes(leg) ? Math.PI : 0);
    const swing = Math.sin(legPhase);
    const lift = Math.max(0, swing);

    // Only the joints actually driven for this gait get written; anything
    // not set here (rolls, TiTa) is read back as 0 by the consumer.
    state.jointAngles[legJointName(leg, "ThC", "pitch")] = swing * SWING_AMPLITUDE;
    state.jointAngles[legJointName(leg, "CTr", "pitch")] = -lift * LIFT_AMPLITUDE;
    state.jointAngles[legJointName(leg, "FTi", "pitch")] = lift * LIFT_AMPLITUDE;
    state.jointAngles[legJointName(leg, "ThC", "yaw")] =
      command.turnRate * TURN_YAW_GAIN * (leg.startsWith("l") ? 1 : -1);
  }
}
