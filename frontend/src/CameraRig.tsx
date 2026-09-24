import type { CameraControls } from "@react-three/drei";
import { useEffect, type RefObject } from "react";
import type { FlyInstanceData } from "./useFlyLayout";

interface CameraRigProps {
  controlsRef: RefObject<CameraControls | null>;
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  focusOffset: [number, number, number];
  overview: { position: [number, number, number]; target: [number, number, number] };
}

export default function CameraRig({
  controlsRef,
  flies,
  selectedFlyId,
  focusOffset,
  overview,
}: CameraRigProps) {
  useEffect(() => {
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

  return null;
}
