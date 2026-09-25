/**
 * A placeholder wing-flap frequency controller — same spirit as
 * tripodGait.ts driving real leg joints with a procedural placeholder gait:
 * this drives the real wing-hinge roll joints (rigMetadata.ts) from
 * flyBrain.ts's motor output, not real indirect-flight-muscle dynamics.
 *
 * Each side is independent, fed by that side's own real DNp01 neuron
 * (flyBrain.ts's motorOutput) rather than one averaged signal for both.
 *
 * Two things this is deliberately NOT:
 * - Not a constant idle buzz. A first draft kept a small always-on
 *   frequency/amplitude floor so the wings never looked "dead." Instead,
 *   the raw per-frame motor output is low-pass filtered into a smoothed
 *   drive, and both frequency and amplitude scale directly off of it with
 *   no floor — at genuine rest, drive decays to ~0 and the wing actually
 *   stops, rather than trembling forever.
 * - Not a symmetric oscillation about the folded rest pose. The wing's own
 *   roll axis is such that a NEGATIVE angle raises it and a POSITIVE angle
 *   swings it toward/into the body (verified live while fixing the "wing
 *   moves the wrong direction" bug) — a plain sin() wave would drive the
 *   body-ward half of every cycle straight into the mesh. A first pass
 *   scaled that half down by a fraction, which still clipped visibly at
 *   high drive; the positive half is now hard-clamped to 0 instead — the
 *   downstroke bottoms out at the neutral folded pose (never past it, at
 *   any drive level) and only the raise (negative) half is ever nonzero.
 */

export interface WingSideState {
  phase: number;
  smoothedDrive: number;
}

export interface WingControllerState {
  left: WingSideState;
  right: WingSideState;
}

export interface WingFlapOutput {
  left: number;
  right: number;
}

const LOW_PASS_TAU_S = 0.15; // smooths raw per-frame brightness spikes into a continuous drive
// Below this, frequency snaps to exactly 0 -- genuinely still, not just faint. Exported so
// flyBuzz.ts can treat "silent" identically for the audible buzz and the visible wing.
export const DRIVE_THRESHOLD = 0.05;
const MAX_HZ = 8; // frequency at full smoothed drive; visible on-screen, NOT the real ~200Hz wingbeat
const MAX_AMPLITUDE_RAD = 1.4; // matches FlyInstances' MAX_WING_LIFT_RAD, already live-verified

export function createWingControllerState(): WingControllerState {
  return {
    left: { phase: 0, smoothedDrive: 0 },
    right: { phase: 0, smoothedDrive: 0 },
  };
}

function stepSide(state: WingSideState, rawDrive: number, dt: number): number {
  state.smoothedDrive += (rawDrive - state.smoothedDrive) * (1 - Math.exp(-dt / LOW_PASS_TAU_S));

  const freq = state.smoothedDrive > DRIVE_THRESHOLD ? state.smoothedDrive * MAX_HZ : 0;
  state.phase += freq * Math.PI * 2 * dt;

  const angle = Math.sin(state.phase) * state.smoothedDrive * MAX_AMPLITUDE_RAD;
  return Math.min(angle, 0);
}

export function stepWingController(
  state: WingControllerState,
  leftDrive: number,
  rightDrive: number,
  dt: number,
): WingFlapOutput {
  return {
    left: stepSide(state.left, leftDrive, dt),
    right: stepSide(state.right, rightDrive, dt),
  };
}
