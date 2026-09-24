"""Bake the Google DeepMind / HHMI Janelia "flybody" model (from flygym) to a
rigged GLB.

flybody is the fly body most associated with the connectome + ML side of this
space: developed by DeepMind with Janelia (the same institution behind the
FlyWire/hemibrain connectome data), published as "Whole-body simulation of
realistic fruit fly locomotion with deep reinforcement learning" (Nature,
2025), and distributed via google-deepmind/mujoco_menagerie -- the standard
place the robotics/ML community gets curated MuJoCo models. Preferred here
over NeuroMechFly (EPFL) for that reason. Apache-2.0.

Builds the fly standalone (skeleton + neutral pose + per-segment materials
via colorize()), compiles it to a MuJoCo model via FlyBody.compile(), and
exports a genuine hierarchical glTF scene: one node per MuJoCo body, parented
exactly as MuJoCo's own kinematic tree (body_pos/body_quat, which are already
parent-relative), each carrying its geom mesh(es) in body-local coordinates.
This is a real rig -- unlike a flattened world-space bake, the frontend can
rotate individual leg-segment nodes to drive a walking gait. Non-leg bodies
(head, thorax, abdomen segments, wings, antennae) have multiple geoms each;
all are attached to their body's single node (glTF nodes can carry multiple
mesh primitives), each with its own geom-to-body offset already baked into
its vertices.

flybody's meshes only ship "fullsize" (~818k vertices total across the fly --
about 15x NeuroMechFly's bundled simplified set), fetched from flygym's S3
asset bucket on first use and cached locally. Each mesh is decimated down to
a face cap here to keep multi-instance rendering (many flies at once)
reasonable in a browser.

Also writes frontend/src/assets/rig-metadata.json with:
- groundOffsetMm / extentMm (how far to lift a fly instance so its lowest
  point touches world Y=0, and its overall size).
- legs: the 6 leg names ("lf","lm","lh","rf","rm","rh") each mapped to its
  7 actuated joint names, in FlyGym's own order
  (FlyBodyActuatedDOFPreset.LEGS_ACTIVE_ONLY).
- joints: per actuated joint, which glTF node it rotates and its rotation
  axis (in that node's own bind-local frame -- safe to use directly, since
  only the root node gets the MuJoCo->glTF up-axis correction; every other
  node's local frame is untouched MuJoCo-native).

Run with: uv run python export_fly_mesh.py
"""

import json

import mujoco
import numpy as np
import trimesh
from flygym.compose import FlyBody, KinematicPosePreset, MeshType
from flygym.flybody.anatomy_flybody import (
    FlyBodyActuatedDOFPreset,
    FlyBodyAxisOrder,
    FlyBodyJointPreset,
    FlyBodySkeleton,
)

GLB_OUTPUT_PATH = "../frontend/public/models/fly.glb"
METADATA_OUTPUT_PATH = "../frontend/src/assets/rig-metadata.json"

# A fixed per-mesh face CAP (originally 2000, matching NeuroMechFly's bundled
# "simplified_max2000faces" scale) turned out to be far too aggressive here:
# flybody's largest meshes (e.g. c_head_red at 59304 faces) got crushed to as
# little as 3% of their original face count. These are non-watertight partial
# -coverage shell patches (confirmed via mesh.is_watertight == False), not
# solid volumes, and multiple independent patches together make up one
# visible body surface (e.g. c_thorax_body + c_thorax_black) -- decimating
# each that hard punches visible holes that don't line up with any other
# patch's coverage, so the body reads as "missing" with only thin surviving
# fragments (bristles, legs, wings -- meshes small enough to skip decimation
# entirely -- looked fine, which is what gave this away). A proportional
# ratio scales the cut to each mesh's own complexity instead of flattening
# everything to the same small number.
DECIMATION_RATIO = 0.4  # keep this fraction of a mesh's original faces
MIN_FACES_BEFORE_DECIMATION = 1500  # meshes at or below this are left untouched

# MuJoCo/flygym uses a Z-up world (confirmed empirically: leg tarsi sit far
# below the thorax/head in Z, head/abdomen are separated along X, left/right
# pairs are separated along Y). glTF (and three.js/OrbitControls) expect Y-up.
# Rotate -90 degrees about X: (x, y, z) -> (x, z, -y). Determinant is +1, so
# this is a proper rotation (no mirroring/winding-order flip). Applied ONLY
# to the root (thorax) node's own transform — every other body's local
# parent-relative transform is untouched, since a global relabeling of world
# axes doesn't change what "local" means for a child relative to its own
# parent.
MUJOCO_TO_GLTF_UP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)

LEG_PREFIXES = ["lf", "lm", "lh", "rf", "rm", "rh"]


def build_model():
    fly = FlyBody(mesh_type=MeshType.FULLSIZE)  # only mesh type flybody supports
    skeleton = FlyBodySkeleton(
        joint_preset=FlyBodyJointPreset.ALL_BIOLOGICAL, axis_order=FlyBodyAxisOrder.YAW_ROLL_PITCH
    )
    fly.add_joints(skeleton, KinematicPosePreset.FLYBODY_NEUTRAL)
    fly.colorize()

    mj_model, mj_data = fly.compile()
    mujoco.mj_forward(mj_model, mj_data)
    return mj_model, mj_data, skeleton


def geom_material(mj_model, geom_id):
    mat_id = mj_model.geom_matid[geom_id]
    rgba = mj_model.mat_rgba[mat_id] if mat_id >= 0 else mj_model.geom_rgba[geom_id]
    alpha = float(rgba[3])
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=tuple(float(c) for c in rgba),
        metallicFactor=0.05,
        roughnessFactor=0.6,
        alphaMode="BLEND" if alpha < 1.0 else "OPAQUE",
        # Quadric decimation (see build_geom_mesh) can leave a face's winding
        # inconsistent with its neighbors on organic/scanned source meshes;
        # single-sided rendering then back-face-culls chunks of the body,
        # which looks like transparency (only thin bristle/hair geometry,
        # which is usually under the decimation threshold and left alone,
        # stays visible). Double-sided avoids that regardless of winding.
        doubleSided=True,
    )


def quat_to_rotmat(quat):
    """MuJoCo quaternions are (w, x, y, z)."""
    w, x, y, z = quat
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )


def compute_ground_offset(mj_model, mj_data, thorax_body_id):
    """World-frame (post axis-swap) lowest point, relative to the thorax
    body's own origin -- independent of how the rig is stored, since this
    only needs each geom's *world* pose (already computed by mj_forward).
    """
    thorax_world = mj_data.xpos[thorax_body_id] @ MUJOCO_TO_GLTF_UP.T

    min_y = np.inf
    min_y_geom_name = None
    for geom_id in range(mj_model.ngeom):
        mesh_id = mj_model.geom_dataid[geom_id]
        if mesh_id < 0:
            continue
        vert_start = mj_model.mesh_vertadr[mesh_id]
        vert_count = mj_model.mesh_vertnum[mesh_id]
        verts_local = mj_model.mesh_vert[vert_start : vert_start + vert_count]

        xpos = mj_data.geom_xpos[geom_id]
        xmat = mj_data.geom_xmat[geom_id].reshape(3, 3)
        verts_world = (verts_local @ xmat.T + xpos) @ MUJOCO_TO_GLTF_UP.T

        geom_min_y = verts_world[:, 1].min()
        if geom_min_y < min_y:
            min_y = geom_min_y
            min_y_geom_name = mj_model.geom(geom_id).name or f"geom_{geom_id}"

    return float(-(min_y - thorax_world[1])), min_y_geom_name


def compute_facing_offset(mj_model, mj_data, thorax_body_id):
    """Angle (radians, atan2(x, z) convention -- matches the frontend's
    heading math) of the model's own bind-pose forward direction, measured
    thorax-to-head in the post axis-swap frame. The rig's bind pose does NOT
    necessarily face +Z, so the frontend needs this offset to correctly turn
    the mesh to visually face its direction of travel instead of e.g.
    appearing to strafe sideways.
    """
    head_body_id = mujoco.mj_name2id(mj_model, mujoco.mjtObj.mjOBJ_BODY, "c_head")
    thorax_world = mj_data.xpos[thorax_body_id] @ MUJOCO_TO_GLTF_UP.T
    head_world = mj_data.xpos[head_body_id] @ MUJOCO_TO_GLTF_UP.T
    delta = head_world - thorax_world
    return float(np.arctan2(delta[0], delta[2]))


def build_geom_mesh(mj_model, mj_data, body_id, geom_id):
    mesh_id = mj_model.geom_dataid[geom_id]
    vert_start = mj_model.mesh_vertadr[mesh_id]
    vert_count = mj_model.mesh_vertnum[mesh_id]
    face_start = mj_model.mesh_faceadr[mesh_id]
    face_count = mj_model.mesh_facenum[mesh_id]

    verts_local = mj_model.mesh_vert[vert_start : vert_start + vert_count]
    faces = mj_model.mesh_face[face_start : face_start + face_count]

    # Fold the geom's own offset from its body frame into the mesh vertices,
    # so the *node* transform can be exactly body_pos/body_quat.
    body_R = mj_data.xmat[body_id].reshape(3, 3)
    body_t = mj_data.xpos[body_id]
    geom_R = mj_data.geom_xmat[geom_id].reshape(3, 3)
    geom_t = mj_data.geom_xpos[geom_id]
    local_R = body_R.T @ geom_R
    local_t = body_R.T @ (geom_t - body_t)
    verts_body_frame = verts_local @ local_R.T + local_t

    mesh = trimesh.Trimesh(vertices=verts_body_frame, faces=faces, process=False)
    if len(mesh.faces) > MIN_FACES_BEFORE_DECIMATION:
        target = max(MIN_FACES_BEFORE_DECIMATION, int(len(mesh.faces) * DECIMATION_RATIO))
        mesh = mesh.simplify_quadric_decimation(face_count=target)
    mesh.visual = trimesh.visual.TextureVisuals(material=geom_material(mj_model, geom_id))
    return mesh


def build_rig_scene(mj_model, mj_data):
    scene = trimesh.Scene()

    for body_id in range(1, mj_model.nbody):  # skip 0 == world
        body_name = mj_model.body(body_id).name
        parent_id = mj_model.body_parentid[body_id]
        is_root = parent_id == 0

        if is_root:
            transform = np.eye(4)
            transform[:3, :3] = MUJOCO_TO_GLTF_UP
            parent_frame = scene.graph.base_frame
        else:
            transform = np.eye(4)
            transform[:3, :3] = quat_to_rotmat(mj_model.body_quat[body_id])
            transform[:3, 3] = mj_model.body_pos[body_id]
            parent_frame = mj_model.body(parent_id).name

        # Register the body's own transform node explicitly (empty -- no
        # mesh of its own). Each geom then attaches as its OWN child node
        # below. A trimesh/glTF node can only reference one mesh; repeatedly
        # calling add_geometry with the same node_name for multiple geoms
        # (the previous approach) silently keeps only the LAST one attached
        # to the scene graph -- the others still end up in the exported
        # file's geometry list but orphaned, never referenced by any node,
        # so they never render. This is what was making multi-geom bodies
        # (head, thorax, abdomen segments -- everything except the
        # single-geom legs) look like they'd lost most of their surface.
        scene.graph.update(frame_to=body_name, frame_from=parent_frame, matrix=transform)

        geom_ids = [g for g in range(mj_model.ngeom) if mj_model.geom_bodyid[g] == body_id]
        for i, geom_id in enumerate(geom_ids):
            mesh = build_geom_mesh(mj_model, mj_data, body_id, geom_id)
            scene.add_geometry(
                mesh,
                node_name=f"{body_name}_geom{i}",
                parent_node_name=body_name,
                # Identity: the geom's own offset from its body frame is
                # already baked into its vertices (see build_geom_mesh).
                transform=np.eye(4),
            )

    return scene


def main():
    mj_model, mj_data, skeleton = build_model()

    thorax_candidates = [b for b in range(1, mj_model.nbody) if mj_model.body_parentid[b] == 0]
    assert len(thorax_candidates) == 1, f"expected exactly one root body, got {thorax_candidates}"
    thorax_body_id = thorax_candidates[0]
    print(f"root body: {mj_model.body(thorax_body_id).name}")

    scene = build_rig_scene(mj_model, mj_data)
    print(f"nodes: {len(scene.graph.nodes)}, geometries: {len(scene.geometry)}")
    total_faces = sum(len(g.faces) for g in scene.geometry.values())
    print(f"total faces after decimation: {total_faces}")

    ground_offset_mm, min_y_geom_name = compute_ground_offset(mj_model, mj_data, thorax_body_id)
    print(f"ground offset (mm): {ground_offset_mm} (lowest point on '{min_y_geom_name}')")

    facing_offset_rad = compute_facing_offset(mj_model, mj_data, thorax_body_id)
    print(f"facing offset (rad): {facing_offset_rad} ({np.degrees(facing_offset_rad):.1f} deg from +Z)")

    bounds = scene.bounds
    extent_mm = (bounds[1] - bounds[0]).tolist()
    print(f"bounding box size (mm): {extent_mm}")

    scene.export(GLB_OUTPUT_PATH)
    print(f"wrote {GLB_OUTPUT_PATH}")

    actuated_dofs = skeleton.get_actuated_dofs_from_preset(FlyBodyActuatedDOFPreset.LEGS_ACTIVE_ONLY)
    legs = {prefix: [] for prefix in LEG_PREFIXES}
    joints = {}
    for jdof in actuated_dofs:
        child_name = jdof.child.name
        prefix = next((p for p in LEG_PREFIXES if child_name.startswith(p + "_")), None)
        if prefix is None:
            continue
        joint_name = f"{jdof.parent.name}-{jdof.child.name}-{jdof.axis.value}"
        legs[prefix].append(joint_name)

        jid = mujoco.mj_name2id(mj_model, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
        joints[joint_name] = {
            "node": child_name,
            "axis": mj_model.jnt_axis[jid].tolist(),
        }

    print(f"legs: { {k: len(v) for k, v in legs.items()} }")
    print(f"actuated joints: {len(joints)}")

    metadata = {
        "groundOffsetMm": ground_offset_mm,
        "extentMm": extent_mm,
        "facingOffsetRad": facing_offset_rad,
        "legs": legs,
        "joints": joints,
    }
    with open(METADATA_OUTPUT_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"wrote {METADATA_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
