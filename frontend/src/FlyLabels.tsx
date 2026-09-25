import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { FLY_EXTENT_MM, type FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";

// Just above the fly's own bounding box, so the label clears the body/wings
// instead of overlapping them.
const LABEL_HEIGHT_MM = FLY_EXTENT_MM[1] + 1.5;
const FONT_SIZE_MM = FLY_EXTENT_MM[0] * 0.4;

interface FlyLabelsProps {
  flies: FlyInstanceData[];
  livePositionsRef: React.RefObject<LiveFlyPositions>;
}

// Own small component (not folded into FlyInstances.tsx) so its per-frame
// position sync stays simple: only the selected fly ever moves, but every
// label still needs to track its own fly's live x/y/z each frame the same
// way, driven off the same livePositionsRef the rest of the scene reads.
export default function FlyLabels({ flies, livePositionsRef }: FlyLabelsProps) {
  const groupRefs = useRef(new Map<string, Group>());

  useFrame(() => {
    const livePositions = livePositionsRef.current;
    for (const fly of flies) {
      const group = groupRefs.current.get(fly.id);
      const live = livePositions.get(fly.id);
      if (!group || !live) continue;
      group.position.set(live.x, live.y + LABEL_HEIGHT_MM, live.z);
    }
  });

  return (
    <>
      {flies.map((fly) => (
        <group
          key={fly.id}
          ref={(group: Group | null) => {
            if (group) groupRefs.current.set(fly.id, group);
            else groupRefs.current.delete(fly.id);
          }}
          position={[fly.position[0], fly.position[1] + LABEL_HEIGHT_MM, fly.position[2]]}
        >
          <Billboard>
            <Text
              fontSize={FONT_SIZE_MM}
              color="#e8e9ee"
              outlineWidth={FONT_SIZE_MM * 0.08}
              outlineColor="#0b0c10"
              anchorX="center"
              anchorY="bottom"
            >
              Fly {fly.index + 1}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
