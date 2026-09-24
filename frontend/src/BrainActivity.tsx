import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, Color, type Points } from "three";
import { NEURON_COUNT, NEURON_POSITIONS, neuronGroup, type NeuronGroup } from "./flyBrain";
import type { LiveFlyPositions } from "./useLiveFlyState";

const GROUP_COLOR: Record<NeuronGroup, Color> = {
  sensory: new Color("#22d3ee"),
  hidden: new Color("#8e56fc"),
  motor: new Color("#f97316"),
};

const BASE_INTENSITY = 0.45; // dim baseline so idle points stay clearly visible

interface CloudProps {
  selectedFlyId: string | null;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
}

// One THREE.Points draw call, 34 vertices, no lights (self-illuminated via
// vertex color) — cheap enough for its own small second WebGL context.
function PointCloud({ selectedFlyId, livePositionsRef }: CloudProps) {
  const pointsRef = useRef<Points>(null);
  const colorArray = useMemo(() => new Float32Array(NEURON_COUNT * 3), []);

  useFrame((_, dt) => {
    const points = pointsRef.current;
    if (!points) return;
    points.rotation.y += dt * 0.15;

    const brain = selectedFlyId ? livePositionsRef.current.get(selectedFlyId)?.brain : undefined;
    const colorAttr = points.geometry.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < NEURON_COUNT; i++) {
      const base = GROUP_COLOR[neuronGroup(i)];
      const level = BASE_INTENSITY + (brain ? brain.brightness[i] * (1 - BASE_INTENSITY) : 0);
      colorAttr.setXYZ(i, base.r * level, base.g * level, base.b * level);
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[NEURON_POSITIONS, 3]} />
        <bufferAttribute attach="attributes-color" args={[colorArray, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.2} vertexColors sizeAttenuation />
    </points>
  );
}

export default function BrainActivity({ selectedFlyId, livePositionsRef }: CloudProps) {
  return (
    <div style={{ borderTop: "1px solid #2a2d3a", padding: "10px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, color: "#8b8d99", marginBottom: 6 }}>
        {selectedFlyId ? "neural activity" : "select a fly to see its activity"}
      </div>
      <div
        style={{
          width: "100%",
          height: 120,
          opacity: selectedFlyId ? 1 : 0.35,
          borderRadius: 4,
          overflow: "hidden",
          background: "#0e0f16",
        }}
      >
        <Canvas
          camera={{ position: [0, 0.3, 3], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ preserveDrawingBuffer: true }}
        >
          {/* Without this the WebGL clear defaults to opaque black, which
              hid the surrounding div's background and made the panel look
              like a bottomless black hole rather than a dark, but visibly
              bounded, viewport. */}
          <color attach="background" args={["#15161d"]} />
          <PointCloud selectedFlyId={selectedFlyId} livePositionsRef={livePositionsRef} />
        </Canvas>
      </div>
    </div>
  );
}
