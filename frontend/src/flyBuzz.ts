/**
 * Audible buzzing per fly, pitched by wingbeat drive -- the audio counterpart
 * to wingController.ts's visual flap. Each fly gets its own two-oscillator
 * (left/right wing) node graph feeding a single shared master volume.
 *
 * The AudioContext is built lazily and only resumed on a user gesture (browser
 * autoplay policy), never at import time -- see resumeAudioContext().
 */

import { DRIVE_THRESHOLD } from "./wingController";

const MEDIUM_VOLUME = 0.5; // fixed master level -- no volume control
const AUDIO_MIN_HZ = 150; // audible insect-buzz register -- not the real ~200Hz wingbeat itself
const AUDIO_MAX_HZ = 250;
const MAX_GAIN_PER_SIDE = 0.15; // keeps many simultaneous flies from summing into clipping
const FILTER_HZ = 1500; // tames the sawtooth's harmonics into a drone rather than a buzz-saw
const PARAM_SMOOTH_TAU_S = 0.03; // bridges per-frame discreteness into a continuous ramp
const DISPOSE_FADE_S = 0.02; // avoids an audible click when a fly's sound is torn down
const DETUNE_SPREAD_CENTS = 8; // per-fly random detune so many flies don't phase-lock into one tone

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function ensureAudio(): void {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = MEDIUM_VOLUME;
  compressor = ctx.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(ctx.destination);
}

/** Must be called from a user gesture handler (browser autoplay policy). Safe to call repeatedly. */
export function resumeAudioContext(): void {
  ensureAudio();
  if (ctx!.state === "suspended") void ctx!.resume();
}

interface WingVoice {
  osc: OscillatorNode;
  gain: GainNode;
}

export interface FlySound {
  left: WingVoice;
  right: WingVoice;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  flyGain: GainNode;
}

function createVoice(audioCtx: AudioContext, detuneCents: number): WingVoice {
  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = AUDIO_MIN_HZ;
  osc.detune.value = detuneCents;
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  osc.start();
  return { osc, gain };
}

/** Requires resumeAudioContext() to have already run; returns null otherwise. */
export function createFlySound(): FlySound | null {
  if (!ctx || !master) return null;
  const left = createVoice(ctx, (Math.random() * 2 - 1) * DETUNE_SPREAD_CENTS);
  const right = createVoice(ctx, (Math.random() * 2 - 1) * DETUNE_SPREAD_CENTS);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = FILTER_HZ;
  const panner = ctx.createStereoPanner();
  const flyGain = ctx.createGain();
  left.gain.connect(filter);
  right.gain.connect(filter);
  filter.connect(panner);
  panner.connect(flyGain);
  flyGain.connect(master);
  return { left, right, filter, panner, flyGain };
}

// wingController.ts's angle = min(sin(phase) * smoothedDrive * MAX_AMPLITUDE_RAD, 0) -- the
// wing is only actually moving (raising) during the negative half of sin(phase), and sits still
// at the folded rest pose the rest of the cycle. max(0, -sin(phase)) reconstructs that same
// 0-1 "is it moving right now" envelope from phase alone, so the buzz pulses in lockstep with
// the visible flap instead of playing a constant tone for as long as drive is nonzero.
function motionEnvelope(phase: number): number {
  return Math.max(0, -Math.sin(phase));
}

function updateVoice(voice: WingVoice, drive: number, phase: number): void {
  const now = ctx!.currentTime;
  const audible = drive > DRIVE_THRESHOLD;
  const targetGain = audible ? drive * motionEnvelope(phase) * MAX_GAIN_PER_SIDE : 0;
  voice.gain.gain.setTargetAtTime(targetGain, now, PARAM_SMOOTH_TAU_S);
  // Only move pitch while audible -- freezing it during silence (gain is already
  // 0) avoids an audible pitch-swoop the next time the fly starts buzzing.
  if (audible) {
    const targetFreq = AUDIO_MIN_HZ + drive * (AUDIO_MAX_HZ - AUDIO_MIN_HZ);
    voice.osc.frequency.setTargetAtTime(targetFreq, now, PARAM_SMOOTH_TAU_S);
  }
}

export function updateFlySound(sound: FlySound, leftDrive: number, rightDrive: number, leftPhase: number, rightPhase: number): void {
  updateVoice(sound.left, leftDrive, leftPhase);
  updateVoice(sound.right, rightDrive, rightPhase);
}

/** distanceGain: 0 (silent, far from camera) - 1 (full volume, close to camera). pan: -1 (left) - 1 (right). */
export function updateFlySpatial(sound: FlySound, distanceGain: number, pan: number): void {
  const now = ctx!.currentTime;
  sound.flyGain.gain.setTargetAtTime(Math.min(1, Math.max(0, distanceGain)), now, PARAM_SMOOTH_TAU_S);
  sound.panner.pan.setTargetAtTime(Math.min(1, Math.max(-1, pan)), now, PARAM_SMOOTH_TAU_S);
}

export function disposeFlySound(sound: FlySound): void {
  const now = ctx!.currentTime;
  const fadeDurationS = DISPOSE_FADE_S * 4;
  sound.flyGain.gain.setTargetAtTime(0, now, DISPOSE_FADE_S);
  const stopAt = now + fadeDurationS;
  for (const voice of [sound.left, sound.right]) {
    voice.osc.stop(stopAt);
    voice.osc.addEventListener("ended", () => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    });
  }
  // Deferred so the flyGain fade above is actually audible instead of being
  // cut off by an immediate disconnect.
  setTimeout(() => {
    sound.filter.disconnect();
    sound.panner.disconnect();
    sound.flyGain.disconnect();
  }, fadeDurationS * 1000);
}
