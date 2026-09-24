import { CameraControls, Grid, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import CameraRig from "./CameraRig";
import { FLY_AREA_CONFIG } from "./env";
import FlyInstances from "./FlyInstances";
import { FLY_EXTENT_MM, type FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";

// Close-up "hero shot" distance/height when a specific fly is selected,
// derived from one fly's own size so every instance gets the same framing
// regardless of where in the ground area it sits. Magnitudes match the
// previous fixed diagonal offset's horizontal/vertical components, now
// applied relative to each fly's own current heading (see CameraRig).
const flyCamDist = Math.max(...FLY_EXTENT_MM) * 2.4;
const FOCUS_BACK_MM = flyCamDist * Math.hypot(0.7, 0.9);
const FOCUS_UP_MM = flyCamDist * 0.35;

// Overview shot sized to the configured ground area, not a single fly.
const areaSize = Math.max(FLY_AREA_CONFIG.widthMm, FLY_AREA_CONFIG.depthMm);
const overviewDist = areaSize * 1.1;
const OVERVIEW = {
  position: [overviewDist * 0.6, overviewDist * 0.5, overviewDist] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
};

interface FlySceneProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
}

export default function FlyScene({
  flies,
  selectedFlyId,
  livePositionsRef,
  joystickRef,
  wingSlidersRef,
}: FlySceneProps) {
  const controlsRef = useRef<CameraControls | null>(null);

  return (
    <Canvas
      camera={{ position: OVERVIEW.position, fov: 40, near: 0.01, far: areaSize * 20 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#6b7280"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      <directionalLight position={[-6, 2, -4]} intensity={0.4} />

      <Suspense fallback={null}>
        <FlyInstances
          flies={flies}
          selectedFlyId={selectedFlyId}
          joystickRef={joystickRef}
          wingSlidersRef={wingSlidersRef}
          livePositionsRef={livePositionsRef}
        />
      </Suspense>

      <Grid
        position={[0, 0, 0]}
        args={[areaSize * 1.5, areaSize * 1.5]}
        cellSize={areaSize / 40}
        sectionSize={areaSize / 6}
        cellColor="#2a2d3a"
        sectionColor="#3d4152"
        fadeDistance={areaSize * 3}
        infiniteGrid
      />

      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.4}
        dollySpeed={2.5}
        minDistance={flyCamDist * 0.3}
        maxDistance={areaSize * 5}
      />
      <CameraRig
        controlsRef={controlsRef}
        selectedFlyId={selectedFlyId}
        focusBackMm={FOCUS_BACK_MM}
        focusUpMm={FOCUS_UP_MM}
        overview={OVERVIEW}
        livePositionsRef={livePositionsRef}
      />
    </Canvas>
  );
}

useGLTF.preload("/models/fly.glb");
