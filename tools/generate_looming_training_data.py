"""Generate synthetic training data for the looming/proximity wing-flap
response (frontend/src/loomingPerception.ts).

There's no real dataset for "wing flap vs. distance to another fly" in
this synthetic scene, so labels come from a hand-designed target curve
instead of measurements -- this is a deliberate design choice, not a
biology claim. The curve encodes the behavior asked for: closer = higher
response (proximity-dominant, proximity**1.5 so it stays low until a fly
is meaningfully close rather than ramping up linearly from first sight),
amplified when approaching and damped when receding (real looming/LGMD-
style detectors respond to the rate of closure, not just raw distance),
and a directional left/right split from bearing -- a fly approached from
the left flaps its left wing harder (chosen for a readable, richer
behavior; DNp01 itself isn't a real directional-steering circuit).

Ranges match the app's actual scale (frontend/src/env.ts's default 120mm
ground area, FlyInstances.tsx's MAX_FORWARD_SPEED_MM_S=18) so the trained
model sees realistic inputs, not an arbitrary unit range.

Run with: uv run python generate_looming_training_data.py
"""

import json

import numpy as np

DETECTION_RANGE_MM = 40.0  # a fly's own body is ~3.8mm; ~1/3 of the 120mm ground area
MAX_CLOSING_SPEED_MM_S = 20.0  # a little above MAX_FORWARD_SPEED_MM_S (18) for headroom
FOV_HALF_ANGLE_RAD = 2.0  # ~115 degrees each side -- wide, not full 360

N_SAMPLES = 20_000
RNG_SEED = 7
OUTPUT_PATH = "looming_training_data.json"


def label(distance, closing_speed, bearing):
    proximity = np.clip(1.0 - distance / DETECTION_RANGE_MM, 0.0, 1.0)
    approach = np.clip(closing_speed / MAX_CLOSING_SPEED_MM_S, -1.0, 1.0)
    base = np.clip(proximity**1.5 * (1.0 + 0.5 * approach), 0.0, 1.0)

    lateral = np.clip(bearing / FOV_HALF_ANGLE_RAD, -1.0, 1.0)  # -1 fully left .. +1 fully right
    left = np.clip(base * np.clip(1.0 - lateral, 0.0, 2.0) / 2.0, 0.0, 1.0)
    right = np.clip(base * np.clip(1.0 + lateral, 0.0, 2.0) / 2.0, 0.0, 1.0)
    return left, right


def main():
    rng = np.random.default_rng(RNG_SEED)

    distance = rng.uniform(0.0, DETECTION_RANGE_MM, N_SAMPLES)
    closing_speed = rng.uniform(-MAX_CLOSING_SPEED_MM_S, MAX_CLOSING_SPEED_MM_S, N_SAMPLES)
    bearing = rng.uniform(-FOV_HALF_ANGLE_RAD, FOV_HALF_ANGLE_RAD, N_SAMPLES)

    left, right = label(distance, closing_speed, bearing)

    inputs = np.stack([distance, closing_speed, bearing], axis=1)
    targets = np.stack([left, right], axis=1)

    print(f"generated {N_SAMPLES} samples")
    print(f"target left/right range: {targets.min(axis=0)} .. {targets.max(axis=0)}")
    print(f"target left/right mean: {targets.mean(axis=0)}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {
                "detectionRangeMm": DETECTION_RANGE_MM,
                "maxClosingSpeedMmS": MAX_CLOSING_SPEED_MM_S,
                "fovHalfAngleRad": FOV_HALF_ANGLE_RAD,
                "inputs": inputs.tolist(),
                "targets": targets.tolist(),
            },
            f,
        )
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
