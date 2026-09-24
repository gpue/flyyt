import { Clone, useGLTF } from "@react-three/drei";
import type { FlyInstanceData } from "./useFlyLayout";

export default function FlyInstances({ flies }: { flies: FlyInstanceData[] }) {
  const { scene } = useGLTF("/models/fly.glb");
  return (
    <>
      {flies.map((fly) => (
        <Clone key={fly.id} object={scene} position={fly.position} />
      ))}
    </>
  );
}
