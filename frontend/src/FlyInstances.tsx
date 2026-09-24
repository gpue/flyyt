import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Quaternion, Vector3, type Group, type Object3D } from "three";
import { FLY_AREA_CONFIG } from "./env";
import { stepBrain } from "./flyBrain";
import { FACING_OFFSET_RAD, JOINTS, LEGS, type LegName } from "./rigMetadata";
import { stepGait } from "./tripodGait";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";

const MAX_FORWARD_SPEED_MM_S = 18;
const MAX_TURN_RATE_RAD_S = 2.5;

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
  for (const leg of Object.keys(LEGS) as LegName[]) {
    for (const jointName of LEGS[leg]) {
      const info = JOINTS[jointName];
      let group = groups.get(info.node);
      if (!group) {
        group = { node: info.node, joints: [] };
        groups.set(info.node, group);
      }
      group.joints.push({ name: jointName, axis: new Vector3(...info.axis) });
    }
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
  livePositionsRef: React.RefObject<LiveFlyPositions>;
}

export default function FlyInstances({
  flies,
  selectedFlyId,
  joystickRef,
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

    if (command.forwardSpeed === 0 && command.turnRate === 0) return;

    stepGait(live.gait, command, dt);

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
        />
      ))}
    </>
  );
}
