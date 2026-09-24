/**
 * A small placeholder spiking neuron population — NOT the real FlyWire
 * connectome / Brian2 LIF network from Shiu et al. That network is ~139k
 * neurons / ~50M synapses and, per every reference implementation
 * researched (philshiu/Drosophila_brain_model, eonsystemspbc/fly-brain,
 * dtch1997/fly-api, neilt93/Fly-Brain-AI, vaibhavkedarisetti/fruit-fly-lab),
 * is NOT real-time anywhere — fruit-fly-lab's own optimized event-driven
 * engine reports ~10x slower than real-time. Running one live instance of
 * the real thing per fly, every animation frame, in a browser, isn't
 * feasible with any known implementation.
 *
 * This is a small (500-unit) leaky-integrate-and-fire population instead,
 * with the same shape of interface (create / step / read activity) so a
 * later real backend-streamed brain is a drop-in replacement — same spirit
 * as tripodGait.ts driving real joint names with a placeholder gait
 * function. The "sensory" and "motor" groups are the canonical minimal
 * sensorimotor demo used across the reference repos (LC4/LPLC2 visual-
 * looming input -> DNp01 "Giant Fibre" escape output) — and every neuron
 * here is a REAL FlyWire neuron at its REAL anatomical position (see
 * NEURON_POSITIONS below) — but the *connectivity* between them
 * (BrainState.weights) is still a random fixed matrix, not real connectome
 * synapses (which aren't loaded here).
 */

import brainPositions from "./assets/brain-positions.json";

// Group sizes come from the baked data itself (tools/export_brain_positions.py)
// rather than being hardcoded here, so the two can never drift out of sync:
// every real LC4 + LPLC2 neuron (sensory), both real DNp01 neurons (motor),
// and a real central-brain sample (hidden).
export const SENSORY_COUNT = brainPositions.sensoryCount;
export const HIDDEN_COUNT = brainPositions.hiddenCount;
export const MOTOR_COUNT = brainPositions.motorCount;
export const NEURON_COUNT = SENSORY_COUNT + HIDDEN_COUNT + MOTOR_COUNT;

export type NeuronGroup = "sensory" | "hidden" | "motor";

export function neuronGroup(index: number): NeuronGroup {
  if (index < SENSORY_COUNT) return "sensory";
  if (index < SENSORY_COUNT + HIDDEN_COUNT) return "hidden";
  return "motor";
}

const TAU_S = 0.02; // membrane time constant
const THRESHOLD = 1;
const NOISE_AMPLITUDE = 0.6; // baseline/spontaneous drive
const RECURRENT_GAIN = 0.5;
const CONNECTION_DENSITY = 0.15;
const BRIGHTNESS_DECAY_TAU_S = 0.3; // afterglow when a neuron fires

// Static point-cloud layout, shared by every fly's brain (population shape
// is identical across instances; only activity differs). These are REAL
// FlyWire FAFB v783 neuron positions, baked by tools/export_brain_positions.py
// from flyconnectome/flywire_annotations: every real LC4 (104) + LPLC2 (210)
// neuron for "sensory", both real DNp01 neurons (the full population --
// there are only 2, the "Giant Fibre" pair) for "motor", and a real sample
// from FlyWire's central-brain super_class for "hidden". Order matches
// neuronGroup(): sensory first, then hidden, then motor. Real anatomy, not
// a synthetic scatter -- but the *connectivity* between them
// (BrainState.weights, below) is still a random fixed matrix, not real
// connectome synapses (which aren't loaded here); these neurons aren't
// claimed to form one real circuit together.
export const NEURON_POSITIONS = new Float32Array(brainPositions.positions);

export interface BrainState {
  potentials: Float32Array;
  spiked: Uint8Array;
  /** 0-1 per neuron, set to 1 on spike, decays each step — drives the point-cloud visualization. */
  brightness: Float32Array;
  weights: Float32Array; // NEURON_COUNT x NEURON_COUNT, row = source, col = target
}

function randomWeights(): Float32Array {
  const weights = new Float32Array(NEURON_COUNT * NEURON_COUNT);
  for (let i = 0; i < NEURON_COUNT; i++) {
    for (let j = 0; j < NEURON_COUNT; j++) {
      if (i === j) continue;
      if (Math.random() < CONNECTION_DENSITY) {
        weights[i * NEURON_COUNT + j] = (Math.random() * 2 - 1) * RECURRENT_GAIN;
      }
    }
  }
  return weights;
}

export function createBrain(): BrainState {
  return {
    potentials: new Float32Array(NEURON_COUNT),
    spiked: new Uint8Array(NEURON_COUNT),
    brightness: new Float32Array(NEURON_COUNT),
    weights: randomWeights(),
  };
}

/**
 * @param sensoryDrive 0-1, extra input current for the sensory group — the
 * one real sensor-like signal currently available in the app is the
 * joystick/movement command, not an actual vision pipeline (that's future
 * work per context.md).
 */
export function stepBrain(state: BrainState, sensoryDrive: number, dt: number): void {
  const { potentials, spiked, brightness, weights } = state;
  const decay = dt / TAU_S;
  const brightnessDecay = Math.exp(-dt / BRIGHTNESS_DECAY_TAU_S);

  const recurrentInput = new Float32Array(NEURON_COUNT);
  for (let i = 0; i < NEURON_COUNT; i++) {
    if (!spiked[i]) continue;
    for (let j = 0; j < NEURON_COUNT; j++) {
      recurrentInput[j] += weights[i * NEURON_COUNT + j];
    }
  }

  for (let i = 0; i < NEURON_COUNT; i++) {
    const noise = (Math.random() * 2 - 1) * NOISE_AMPLITUDE;
    const sensoryInput = neuronGroup(i) === "sensory" ? sensoryDrive * 2 : 0;
    const input = noise + sensoryInput + recurrentInput[i];
    potentials[i] += decay * (-potentials[i] + input);

    brightness[i] *= brightnessDecay;
    if (potentials[i] >= THRESHOLD) {
      spiked[i] = 1;
      potentials[i] = 0;
      brightness[i] = 1;
    } else {
      spiked[i] = 0;
    }
  }
}
