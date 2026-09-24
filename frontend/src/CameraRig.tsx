import type { CameraControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Vector3 } from "three";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";

interface CameraRigProps {
  controlsRef: RefObject<CameraControls | null>;
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  focusOffset: [number, number, number];
  overview: { position: [number, number, number]; target: [number, number, number] };
  livePositionsRef: RefObject<LiveFlyPositions>;
}

interface FollowState {
  x: number;
  y: number;
  z: number;
  heading: number;
}

export default function CameraRig({
  controlsRef,
  flies,
  selectedFlyId,
  focusOffset,
  overview,
  livePositionsRef,
}: CameraRigProps) {
  const lastFollowed = useRef<FollowState | null>(null);

  useEffect(() => {
    lastFollowed.current = null;

    const controls = controlsRef.current;
    if (!controls) return;

    const fly = flies.find((f) => f.id === selectedFlyId);
    if (!fly) {
      const [px, py, pz] = overview.position;
      const [tx, ty, tz] = overview.target;
      controls.setLookAt(px, py, pz, tx, ty, tz, true);
      return;
    }

    const [tx, ty, tz] = fly.position;
    const [ox, oy, oz] = focusOffset;
    controls.setLookAt(tx + ox, ty + oy, tz + oz, tx, ty, tz, true);
    // controlsRef/flies/focusOffset/overview are stable across the session;
    // only a change in selection should trigger a new camera transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlyId]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !selectedFlyId) return;

    const live = livePositionsRef.current.get(selectedFlyId);
    if (!live) return;

    const last = lastFollowed.current;
    if (last) {
      const dx = live.x - last.x;
      const dy = live.y - last.y;
      const dz = live.z - last.z;
      const dHeading = live.heading - last.heading;

      if (dx !== 0 || dy !== 0 || dz !== 0 || dHeading !== 0) {
        const pos = new Vector3();
        const target = new Vector3();
        controls.getPosition(pos);
        controls.getTarget(target);

        // Rigidly-attached chase camera: whatever rotation the fly turns
        // through, rotate the camera's offset from it by the SAME amount,
        // so the camera stays at a constant relative angle behind the fly
        // instead of holding a fixed world orientation while the fly spins
        // underneath it. Without this, "joystick right" only turns the fly
        // to screen-right for as long as the camera happens to still be
        // roughly behind it — after enough turning the camera ends up
        // beside or in front of the fly and left/right reads as reversed.
        const offset = pos.clone().sub(target);
        if (dHeading !== 0) offset.applyAxisAngle(new Vector3(0, 1, 0), dHeading);

        const newTarget = target.clone().add(new Vector3(dx, dy, dz));
        const newPos = newTarget.clone().add(offset);

        controls.setPosition(newPos.x, newPos.y, newPos.z, false);
        controls.setTarget(newTarget.x, newTarget.y, newTarget.z, false);
      }
    }
    lastFollowed.current = { x: live.x, y: live.y, z: live.z, heading: live.heading };
  });

  return null;
}
