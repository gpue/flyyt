"""Bake real FlyWire neuron coordinates for the placeholder brain's point
cloud (frontend/src/flyBrain.ts).

Source: flyconnectome/flywire_annotations (Supplemental_file1_neuron_
annotations.tsv, the FlyWire FAFB v783 whole-brain annotation table --
https://github.com/flyconnectome/flywire_annotations), which has one row per
neuron with pos_x/pos_y/pos_z (its FlyWire-space position) and a `cell_type`
column. Verified counts match the real published numbers exactly: 104 LC4,
210 LPLC2, 2 DNp01.

Populations (matches flyBrain.ts's SENSORY_COUNT/HIDDEN_COUNT/MOTOR_COUNT):
- sensory (314): every real LC4 (104) + every real LPLC2 (210) neuron -- the
  full population, not a sample. Standard visual-looming input pair used
  across the reference repos researched for this project.
- motor (2): both real DNp01 neurons (the "Giant Fibre" escape pair) -- also
  the full population; there are only 2.
- hidden (184): a fixed random sample of real neurons from FlyWire's
  `super_class == "central"` (central-brain, integrative neurons -- distinct
  from the optic/sensory periphery and motor output), standing in for
  generic recurrent/processing units. Not a claim that these specific
  neurons form any particular real circuit with the sensory/motor picks
  above -- just real anatomical positions instead of a synthetic scatter.

500 points total: enough density to actually read as an anatomical cloud
(rather than a handful of scattered dots) while staying cheap -- one Points
draw call, and the LIF step/recurrent-weight cost scales fine at this size
(~1MB weight matrix per fly).

FlyWire's FAFB coordinates are anisotropic voxel-space (~4x4x40nm per
voxel), confirmed empirically here (pos_z's range is ~10x smaller than pos_x
/pos_y's for the same neurons) -- pos_z is scaled by 10 before normalizing
so the baked point cloud isn't artificially flattened.

Run with: uv run python export_brain_positions.py
"""

import csv
import io
import json
import random
import urllib.request

import numpy as np

ANNOTATIONS_URL = (
    "https://raw.githubusercontent.com/flyconnectome/flywire_annotations/"
    "main/supplemental_files/Supplemental_file1_neuron_annotations.tsv"
)
OUTPUT_PATH = "../frontend/src/assets/brain-positions.json"

Z_VOXEL_SCALE = 10.0  # corrects FAFB's anisotropic ~4x4x40nm voxel grid
RNG_SEED = 42
HIDDEN_COUNT = 184


def fetch_rows():
    print(f"downloading {ANNOTATIONS_URL} ...")
    with urllib.request.urlopen(ANNOTATIONS_URL) as resp:
        text = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text), delimiter="\t"))


def position(row):
    return np.array([float(row["pos_x"]), float(row["pos_y"]), float(row["pos_z"]) * Z_VOXEL_SCALE])


def main():
    rows = fetch_rows()
    print(f"loaded {len(rows)} neuron rows")

    sensory_rows = [r for r in rows if r["cell_type"] in ("LC4", "LPLC2")]
    motor_rows = [r for r in rows if r["cell_type"] == "DNp01"]
    assert len(motor_rows) == 2, len(motor_rows)

    central_rows = [r for r in rows if r["super_class"] == "central" and r["pos_x"]]
    hidden_rows = random.Random(RNG_SEED).sample(central_rows, HIDDEN_COUNT)

    print(f"sensory: {len(sensory_rows)} (every real LC4 + LPLC2 neuron)")
    print(f"hidden: {len(hidden_rows)} (real 'central' super_class sample)")
    print(f"motor: {len(motor_rows)} (both real DNp01 neurons)")

    ordered_rows = sensory_rows + hidden_rows + motor_rows
    total = len(ordered_rows)
    positions = np.array([position(r) for r in ordered_rows])

    # Center on the combined centroid and scale to roughly [-1.3, 1.3] so it
    # drops straight into the existing small point-cloud viewport.
    centroid = positions.mean(axis=0)
    centered = positions - centroid
    scale = 1.3 / np.abs(centered).max()
    normalized = centered * scale

    print(f"total neurons: {total}")
    print(f"bounding box after normalization: {normalized.min(axis=0)} .. {normalized.max(axis=0)}")

    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {
                "sensoryCount": len(sensory_rows),
                "hiddenCount": len(hidden_rows),
                "motorCount": len(motor_rows),
                "positions": normalized.flatten().round(4).tolist(),
            },
            f,
        )
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
