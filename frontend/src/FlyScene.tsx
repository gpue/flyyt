import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

// Baked from the NeuroMechFly v2 model (mm units); see tools/export_fly_mesh.py.
const FLY_EXTENT_MM = 3.6;

function FlyModel() {
  const { scene } = useGLTF("/models/fly.glb");
  return <primitive object={scene} />;
}

export default function FlyScene() {
  const camDist = FLY_EXTENT_MM * 2.4;

  return (
    <Canvas
      camera={{ position: [camDist * 0.7, camDist * 0.35, camDist * 0.9], fov: 40, near: 0.01, far: 200 }}
    >
      <color attach="background" args={["#0b0c10"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      <directionalLight position={[-6, 2, -4]} intensity={0.4} />

      <Suspense fallback={null}>
        <FlyModel />
      </Suspense>

      <Grid
        position={[0, -FLY_EXTENT_MM * 0.7, 0]}
        args={[FLY_EXTENT_MM * 8, FLY_EXTENT_MM * 8]}
        cellSize={FLY_EXTENT_MM / 4}
        sectionSize={FLY_EXTENT_MM * 2}
        cellColor="#2a2d3a"
        sectionColor="#3d4152"
        fadeDistance={FLY_EXTENT_MM * 15}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        minDistance={FLY_EXTENT_MM * 0.6}
        maxDistance={FLY_EXTENT_MM * 15}
      />
    </Canvas>
  );
}

useGLTF.preload("/models/fly.glb");
