import { Clone, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Quaternion, Vector3, type Group, type Object3D } from "three";
import { createFlySound, disposeFlySound, type FlySound, updateFlySound, updateFlySpatial } from "./flyBuzz";
import { FLY_AREA_CONFIG } from "./env";
import { motorOutput, stepBrain } from "./flyBrain";
import { computeLoomingDrive } from "./loomingPerception";
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

// Calibrated to CameraRig.tsx's chase distance (~11mm from a selected fly)
// and the overview camera's distance to the far side of the play area
// (~130-170mm for the default 120x120mm FLY_AREA_CONFIG) -- full volume at
// chase range, silent by the time the overview camera is looking across the
// whole area.
const AUDIO_NEAR_MM = 12;
const AUDIO_FAR_MM = 160;

// Unselected flies get no manual input -- shared zero-value objects so we
// don't allocate a fresh one per fly per frame.
const ZERO_JOYSTICK = { x: 0, y: 0 };
const ZERO_WINGS = { left: 0, right: 0 };

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
  onSelectFly: (id: string | null) => void;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
}

export default function FlyInstances({
  flies,
  selectedFlyId,
  onSelectFly,
  joystickRef,
  wingSlidersRef,
  livePositionsRef,
}: FlyInstancesProps) {
  const { scene } = useGLTF("/models/fly.glb");
  const { camera } = useThree();
  const groupRefs = useRef(new Map<string, Group>());
  const rigCache = useRef(new Map<string, Map<string, RigNode>>());
  const soundsRef = useRef(new Map<string, FlySound>());
  const tmpQuat = useRef(new Quaternion());
  const jointQuat = useRef(new Quaternion());
  const cameraForward = useRef(new Vector3());

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

  // Sound nodes need a live AudioContext (only available after a user
  // gesture), so this returns null until resumeAudioContext() has run --
  // getOrCreateSound is then retried every frame until it succeeds.
  const getOrCreateSound = (flyId: string): FlySound | null => {
    let sound = soundsRef.current.get(flyId);
    if (sound) return sound;
    sound = createFlySound() ?? undefined;
    if (sound) soundsRef.current.set(flyId, sound);
    return sound ?? null;
  };

  // Flies that disappear from the list still have live oscillators consuming
  // CPU and making sound, unlike rigCache's dormant geometry entries -- so
  // unlike rigCache, these are explicitly pruned.
  useEffect(() => {
    const liveIds = new Set(flies.map((fly) => fly.id));
    for (const [id, sound] of soundsRef.current) {
      if (!liveIds.has(id)) {
        disposeFlySound(sound);
        soundsRef.current.delete(id);
      }
    }
  }, [flies]);

  useEffect(() => {
    const sounds = soundsRef.current;
    return () => {
      for (const sound of sounds.values()) disposeFlySound(sound);
      sounds.clear();
    };
  }, []);

  useFrame((_, dt) => {
    const livePositions = livePositionsRef.current;
    camera.getWorldDirection(cameraForward.current);

    // Every fly's brain/vision/wings update every frame now (not just the
    // selected one), so any fly -- driven or idle -- can sense and react to
    // a nearby fly, including the one being steered. Only the SELECTED fly
    // reads the joystick/wing sliders and ever translates; every other fly
    // stays put but is fully "alive" (spontaneous brain activity, and now a
    // real proximity sense driving its own wings).
    for (const fly of flies) {
      const live = livePositions.get(fly.id);
      const group = groupRefs.current.get(fly.id);
      if (!live || !group) continue;

      const isSelected = fly.id === selectedFlyId;
      const joystick = isSelected ? joystickRef.current : ZERO_JOYSTICK;

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

      // "Vision": nearest other fly within range/FOV, turned into a
      // per-wing drive by a small offline-trained model (loomingPerception.ts).
      const loom = computeLoomingDrive(fly.id, live, livePositions, dt);

      // The brain keeps ticking (with baseline/spontaneous activity)
      // whether or not this fly is currently being driven or being
      // approached -- only the gait/translation below is gated on an
      // active walk command. sensoryDrive is the max of joystick magnitude
      // and the looming drive, so the point-cloud panel's sensory cluster
      // visibly lights up from an approaching fly too, not just manual input.
      const sensoryDrive = Math.min(1, Math.max(Math.hypot(joystick.x, joystick.y), loom.left, loom.right));
      stepBrain(live.brain, sensoryDrive, dt);

      // Only the leg gait is gated on an active walk command -- the joint
      // composition below must run every frame regardless, or any joint left
      // non-zero (a mid-stride leg, a raised wing slider) freezes there
      // forever the instant the fly stops walking, since nothing else ever
      // re-applies jointAngles back onto the rig. This is what made the wing
      // hinge appear stuck in a "strange position" after a slider/test drive:
      // the composition loop simply stopped running once movement stopped.
      // AUTOMATIC (an active backend VDA5050 order, useVda5050Nats.ts) takes
      // position/heading authority away from the local joystick entirely --
      // orders are waypoint-based, not a teleop signal, so the two can't
      // both drive movement at once.
      const isWalking = isSelected && live.operatingMode !== "AUTOMATIC" && (command.forwardSpeed !== 0 || command.turnRate !== 0);
      if (isWalking) stepGait(live.gait, command, dt);

      const wings = isSelected ? wingSlidersRef.current : ZERO_WINGS;
      // Both negative, NOT mirrored: despite l_wing/r_wing being placed
      // symmetrically, their body_quat orientations in the compiled MuJoCo
      // model aren't mirror images of each other, so the same local roll axis
      // ([1,0,0] for both, per rig-metadata.json) doesn't point to opposite
      // world directions on the two sides. Verified live: +delta on the left
      // rotated it down/under the body (visibly wrong), while -delta on
      // either side raises that wing cleanly. The slider is a static bias
      // (manual posing, only meaningful for the fly you're driving); the
      // brain's motor output plus the looming drive add a flapping
      // oscillation on top via wingController.ts.
      const flap = stepWingController(
        live.wingController,
        clamp(motorOutput(live.brain, "left") + loom.left, 0, 1),
        clamp(motorOutput(live.brain, "right") + loom.right, 0, 1),
        dt,
      );
      live.gait.jointAngles[wingJointName("l", "roll")] = -wings.left * MAX_WING_LIFT_RAD + flap.left;
      live.gait.jointAngles[wingJointName("r", "roll")] = -wings.right * MAX_WING_LIFT_RAD + flap.right;

      const sound = getOrCreateSound(fly.id);
      if (sound) {
        updateFlySound(
          sound,
          live.wingController.left.smoothedDrive,
          live.wingController.right.smoothedDrive,
          live.wingController.left.phase,
          live.wingController.right.phase,
        );

        // Camera-relative stereo panning + distance falloff -- mirrors
        // loomingPerception.ts's forward/right projection + atan2 bearing
        // pattern, but relative to the camera instead of another fly's
        // heading. XZ-plane only (ignores camera pitch/fly height): a simple
        // stereo azimuth, not full 3D positional audio.
        const dx = live.x - camera.position.x;
        const dy = live.y - camera.position.y;
        const dz = live.z - camera.position.z;
        const distance = Math.hypot(dx, dy, dz);
        const forwardX = cameraForward.current.x;
        const forwardZ = cameraForward.current.z;
        const rightX = forwardZ;
        const rightZ = -forwardX;
        const bearing = Math.atan2(dx * rightX + dz * rightZ, dx * forwardX + dz * forwardZ);
        const distanceGain = clamp(1 - (distance - AUDIO_NEAR_MM) / (AUDIO_FAR_MM - AUDIO_NEAR_MM), 0, 1);
        const pan = clamp(Math.sin(bearing), -1, 1);
        updateFlySpatial(sound, distanceGain, pan);
      }

      const rig = getRig(fly.id, group);
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

      if (isWalking) {
        live.heading += command.turnRate * dt;
        live.x = clamp(live.x + Math.sin(live.heading) * command.forwardSpeed * dt, -HALF_WIDTH, HALF_WIDTH);
        live.z = clamp(live.z + Math.cos(live.heading) * command.forwardSpeed * dt, -HALF_DEPTH, HALF_DEPTH);
      }

      // Always sync the rendered transform from live.{x,y,z,heading} --
      // that's the single source of truth regardless of who last wrote it
      // (local walking just above, or useVda5050Nats.ts for an AUTOMATIC
      // fly). Previously this was gated on isWalking, which was harmless
      // when nothing but local walking ever touched live.* -- now that a
      // backend order can move an unselected/AUTOMATIC fly too, skipping
      // this sync would silently leave its mesh frozen at its spawn point
      // while its actual position kept changing underneath it.
      group.position.set(live.x, live.y, live.z);
      // The rig's bind pose faces FACING_OFFSET_RAD in world terms (not +Z),
      // so subtract it to make rotation.y actually turn the mesh to face its
      // direction of travel instead of appearing to strafe sideways.
      group.rotation.y = live.heading - FACING_OFFSET_RAD;
    }
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
          onClick={(e) => {
            e.stopPropagation();
            onSelectFly(fly.id === selectedFlyId ? null : fly.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default";
          }}
        />
      ))}
    </>
  );
}
