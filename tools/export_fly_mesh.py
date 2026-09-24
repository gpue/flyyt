"""Bake the NeuroMechFly v2 body (from flygym) to a single static GLB.

Builds the fly standalone (skeleton + neutral pose + per-segment materials via
colorize()), compiles it to a MuJoCo model via NeuroMechFly.compile() (the same
"preview" path flygym itself uses for save_xml/preview_model — no ground world
needed, so there's no ground-plane geom to filter out), and bakes every geom's
world-space mesh + material color into one glTF scene, recentered on the fly's
bounding box. This lets the frontend load a plain GLB with no Python/MuJoCo
runtime dependency.

Run with: uv run python export_fly_mesh.py
"""

import mujoco
import numpy as np
import trimesh
from flygym.anatomy import AxisOrder, JointPreset, Skeleton
from flygym.compose import KinematicPosePreset, NeuroMechFly

OUTPUT_PATH = "../frontend/public/models/fly.glb"

# MuJoCo/flygym uses a Z-up world (confirmed empirically: leg tarsi sit far
# below the thorax/head in Z, head/abdomen are separated along X, left/right
# pairs are separated along Y). glTF (and three.js/OrbitControls) expect Y-up.
# Rotate -90 degrees about X: (x, y, z) -> (x, z, -y). Determinant is +1, so
# this is a proper rotation (no mirroring/winding-order flip).
MUJOCO_TO_GLTF_UP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)


def build_model():
    fly = NeuroMechFly()
    skeleton = Skeleton(joint_preset=JointPreset.ALL_BIOLOGICAL, axis_order=AxisOrder.YAW_PITCH_ROLL)
    fly.add_joints(skeleton, KinematicPosePreset.NEUTRAL)
    fly.colorize()

    mj_model, mj_data = fly.compile()
    mujoco.mj_forward(mj_model, mj_data)
    return mj_model, mj_data


def geom_material(mj_model, geom_id):
    mat_id = mj_model.geom_matid[geom_id]
    rgba = mj_model.mat_rgba[mat_id] if mat_id >= 0 else mj_model.geom_rgba[geom_id]
    alpha = float(rgba[3])
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=tuple(float(c) for c in rgba),
        metallicFactor=0.05,
        roughnessFactor=0.6,
        alphaMode="BLEND" if alpha < 1.0 else "OPAQUE",
    )


def bake_scene(mj_model, mj_data):
    scene = trimesh.Scene()

    thorax_id = mujoco.mj_name2id(mj_model, mujoco.mjtObj.mjOBJ_GEOM, "c_thorax")
    thorax_center = (mj_data.geom_xpos[thorax_id] @ MUJOCO_TO_GLTF_UP.T)

    for geom_id in range(mj_model.ngeom):
        mesh_id = mj_model.geom_dataid[geom_id]
        if mesh_id < 0:
            continue

        vert_start = mj_model.mesh_vertadr[mesh_id]
        vert_count = mj_model.mesh_vertnum[mesh_id]
        face_start = mj_model.mesh_faceadr[mesh_id]
        face_count = mj_model.mesh_facenum[mesh_id]

        verts_local = mj_model.mesh_vert[vert_start : vert_start + vert_count]
        faces = mj_model.mesh_face[face_start : face_start + face_count]

        xpos = mj_data.geom_xpos[geom_id]
        xmat = mj_data.geom_xmat[geom_id].reshape(3, 3)
        verts_world = verts_local @ xmat.T + xpos
        verts_world = verts_world @ MUJOCO_TO_GLTF_UP.T

        mesh = trimesh.Trimesh(vertices=verts_world, faces=faces, process=False)
        mesh.visual = trimesh.visual.TextureVisuals(material=geom_material(mj_model, geom_id))

        geom_name = mj_model.geom(geom_id).name or f"geom_{geom_id}"
        scene.add_geometry(mesh, node_name=geom_name)

    # Center on the thorax (the fly's anatomical core), not the bounding-box
    # midpoint: the neutral pose's dangling legs pull the bbox center well
    # below the body, off-centering the model in the default view.
    scene.apply_translation(-thorax_center)

    return scene


def main():
    mj_model, mj_data = build_model()
    scene = bake_scene(mj_model, mj_data)

    bounds = scene.bounds
    size = bounds[1] - bounds[0]
    print(f"geoms baked: {len(scene.geometry)}")
    print(f"bounding box size (mm): {size}")

    scene.export(OUTPUT_PATH)
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
