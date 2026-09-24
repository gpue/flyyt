# Credits

## Fly body mesh (`frontend/public/models/fly.glb`)

Derived from the NeuroMechFly v2 biomechanical model shipped with
[`NeLy-EPFL/flygym`](https://github.com/NeLy-EPFL/flygym) (`flygym` v2.1.0),
licensed under the [Apache License 2.0](https://github.com/NeLy-EPFL/flygym/blob/main/LICENSE),
Copyright 2023-2026 The NeuroMechFly v2 Authors.

The GLB in this repo is a static bake of the standalone-compiled fly model
(`NeuroMechFly().add_joints(..., KinematicPosePreset.NEUTRAL); .colorize(); .compile()`),
produced by `tools/export_fly_mesh.py`. No modifications were made to the source
meshes themselves beyond combining them into one glTF scene with baked world
transforms and per-segment material colors carried over from `colorize()`.
