import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Quaternion, Vector3, type Group, type Object3D } from "three";
import { FLY_AREA_CONFIG } from "./env";
import { motorOutput, stepBrain } from "./flyBrain";
import { FACING_OFFSET_RAD, JOINTS, LEGS, WINGS, wingJointName, type LegName, type WingSide } from "./rigMetadata";
import { stepGait } from "./tripodGait";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";
import { stepWingController } from "./wingController";

const MAX_FORWARD_SPEED_MM_S = 18;
const MAX_TURN_RATE_RAD_S = 2.5;
// Delta from the rig's neutral bind pose, not an absolute MuJoCo joint
// angle (see the composition loop below) -- empirically verified via a
// live test to raise a wing to roughly its full biomechanical deviation
// range without distorting the mesh.
const MAX_WING_LIFT_RAD = 1.4;

const HALF_WIDTH = FLY_AREA_CONFIG.widthMm / 2;
const HALF_DEPTH = FLY_AREA_CONFIG.depthMm / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Several joints (e.g. ThC yaw/pitch/roll) rotate the SAME rig node, so they
// must be composed together rather than each independently overwriting the
// node's quaternion. Group joint names by the node they target, once, from
// the static rig metadata.
interface NodeGroup {
  node: string;
  joints: { name: string; axis: Vector3 }[];
}

function buildNodeGroups(): NodeGroup[] {
  const groups = new Map<string, NodeGroup>();
  const addJoint = (jointName: string) => {
    const info = JOINTS[jointName];
    let group = groups.get(info.node);
    if (!group) {
      group = { node: info.node, joints: [] };
      groups.set(info.node, group);
    }
    group.joints.push({ name: jointName, axis: new Vector3(...info.axis) });
  };

  for (const leg of Object.keys(LEGS) as LegName[]) {
    for (const jointName of LEGS[leg]) addJoint(jointName);
  }
  // Wing hinges (currently: roll/deviation axis only, driven by the side
  // panel's wing sliders) are composed the same way leg joints are.
  for (const side of Object.keys(WINGS) as WingSide[]) {
    for (const jointName of WINGS[side]) addJoint(jointName);
  }
  return Array.from(groups.values());
}

const NODE_GROUPS = buildNodeGroups();

interface RigNode {
  object: Object3D;
  bindQuaternion: Quaternion;
}

interface FlyInstancesProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
}

export default function FlyInstances({
  flies,
  selectedFlyId,
  joystickRef,
  wingSlidersRef,
  livePositionsRef,
}: FlyInstancesProps) {
  const { scene } = useGLTF("/models/fly.glb");
  const groupRefs = useRef(new Map<string, Group>());
  const rigCache = useRef(new Map<string, Map<string, RigNode>>());
  const tmpQuat = useRef(new Quaternion());
  const jointQuat = useRef(new Quaternion());

  const getRig = (flyId: string, group: Group): Map<string, RigNode> => {
    let rig = rigCache.current.get(flyId);
    if (rig) return rig;
    rig = new Map();
    for (const { node } of NODE_GROUPS) {
      const object = group.getObjectByName(node);
      if (object) rig.set(node, { object, bindQuaternion: object.quaternion.clone() });
    }
    rigCache.current.set(flyId, rig);
    return rig;
  };

  useFrame((_, dt) => {
    if (!selectedFlyId) return;
    const joystick = joystickRef.current;

    const live = livePositionsRef.current.get(selectedFlyId);
    const group = groupRefs.current.get(selectedFlyId);
    if (!live || !group) return;

    const command = {
      forwardSpeed: joystick.y * MAX_FORWARD_SPEED_MM_S,
      // Negated: with the heading/position formulas below (dir = (sin h, cos
      // h), right(h) = (-cos h, 0, sin h)), d(dir)/dh = -right(h) — i.e. a
      // positive turnRate swings the nose toward the fly's own LEFT unless
      // negated here. This is camera-independent (true regardless of the
      // chase-cam's viewing angle), which is what "relative to the fly's
      // orientation" requires.
      turnRate: -joystick.x * MAX_TURN_RATE_RAD_S,
    };

    // The brain keeps ticking (with baseline/spontaneous activity) whether
    // or not the fly is currently being driven — only the gait/translation
    // below is gated on an actual joystick command. The joystick magnitude
    // is the one real sensor-like signal available right now (no vision
    // pipeline yet), fed in as the "sensory" population's extra drive.
    const sensoryDrive = Math.min(1, Math.hypot(joystick.x, joystick.y));
    stepBrain(live.brain, sensoryDrive, dt);

    // Only the leg gait is gated on an active walk command -- the joint
    // composition below must run every frame regardless, or any joint left
    // non-zero (a mid-stride leg, a raised wing slider) freezes there
    // forever the instant the fly stops walking, since nothing else ever
    // re-applies jointAngles back onto the rig. This is what made the wing
    // hinge appear stuck in a "strange position" after a slider/test drive:
    // the composition loop simply stopped running once movement stopped.
    const isWalking = command.forwardSpeed !== 0 || command.turnRate !== 0;
    if (isWalking) stepGait(live.gait, command, dt);

    const wings = wingSlidersRef.current;
    // Both negative, NOT mirrored: despite l_wing/r_wing being placed
    // symmetrically, their body_quat orientations in the compiled MuJoCo
    // model aren't mirror images of each other, so the same local roll axis
    // ([1,0,0] for both, per rig-metadata.json) doesn't point to opposite
    // world directions on the two sides. Verified live: +delta on the left
    // rotated it down/under the body (visibly wrong), while -delta on
    // either side raises that wing cleanly. The slider is a static bias
    // (manual posing); the brain's motor output (each side's own real
    // DNp01) adds a flapping oscillation on top via wingController.ts.
    const flap = stepWingController(
      live.wingController,
      motorOutput(live.brain, "left"),
      motorOutput(live.brain, "right"),
      dt,
    );
    live.gait.jointAngles[wingJointName("l", "roll")] = -wings.left * MAX_WING_LIFT_RAD + flap.left;
    live.gait.jointAngles[wingJointName("r", "roll")] = -wings.right * MAX_WING_LIFT_RAD + flap.right;

    const rig = getRig(selectedFlyId, group);
    for (const { node, joints } of NODE_GROUPS) {
      const rigNode = rig.get(node);
      if (!rigNode) continue;
      const composed = tmpQuat.current.copy(rigNode.bindQuaternion);
      for (const joint of joints) {
        const angle = live.gait.jointAngles[joint.name] ?? 0;
        if (angle === 0) continue;
        jointQuat.current.setFromAxisAngle(joint.axis, angle);
        composed.multiply(jointQuat.current);
      }
      rigNode.object.quaternion.copy(composed);
    }

    if (!isWalking) return;

    live.heading += command.turnRate * dt;
    live.x = clamp(live.x + Math.sin(live.heading) * command.forwardSpeed * dt, -HALF_WIDTH, HALF_WIDTH);
    live.z = clamp(live.z + Math.cos(live.heading) * command.forwardSpeed * dt, -HALF_DEPTH, HALF_DEPTH);

    group.position.set(live.x, live.y, live.z);
    // The rig's bind pose faces FACING_OFFSET_RAD in world terms (not +Z),
    // so subtract it to make rotation.y actually turn the mesh to face its
    // direction of travel instead of appearing to strafe sideways.
    group.rotation.y = live.heading - FACING_OFFSET_RAD;
  });

  return (
    <>
      {flies.map((fly) => (
        <Clone
          key={fly.id}
          ref={(group: Group | null) => {
            if (group) groupRefs.current.set(fly.id, group);
            else groupRefs.current.delete(fly.id);
          }}
          object={scene}
          position={fly.position}
          // Matches the per-frame `live.heading - FACING_OFFSET_RAD` used
          // while walking, so a fly's rendered facing direction is already
          // correct on first paint instead of only updating once it moves.
          rotation={[0, fly.heading - FACING_OFFSET_RAD, 0]}
        />
      ))}
    </>
  );
}
