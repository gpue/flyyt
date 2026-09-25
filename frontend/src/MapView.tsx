/**
 * Renders flyyt-backend's shared VDA5050 map (nodes/edges) in the 3D scene.
 * Ported from nova-assets' Vda5050GraphView.tsx (same react-three-fiber/
 * drei/three stack flyyt already uses) at flyyt's mm scale instead of
 * meter-scale warehouse robots, and without zones (flyyt-backend's map
 * format has none -- see map_store.py). Same (x,y) -> (x, height, -y)
 * coordinate convention used everywhere else VDA5050 positions land in this
 * app (useVda5050Nats.ts, useFlyLayout.ts's roster fetch).
 */

import { Line } from "@react-three/drei";
import { useEffect, useState } from "react";
import { apiPath } from "./env";
import { FLY_EXTENT_MM } from "./useFlyLayout";

const NODE_COLOR = "#8e56fc";
const EDGE_COLOR = "#22d3ee";
const NODE_RADIUS_MM = FLY_EXTENT_MM[0] * 0.25;
const HEIGHT_MM = 0.5;

interface MapNode {
  id: string;
  x: number;
  y: number;
}

interface MapEdge {
  id: string;
  from: string;
  to: string;
}

interface MapData {
  mapId: string;
  mapVersion: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

function toWorld(x: number, y: number, height: number): [number, number, number] {
  return [x, height, -y];
}

async function fetchMap(): Promise<MapData | null> {
  try {
    const res = await fetch(apiPath("map"), { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function MapView() {
  const [map, setMap] = useState<MapData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetchMap().then((data) => {
        if (!cancelled && data) setMap(data);
      });
    };
    poll();
    // Polled, not push -- simplest way to pick up a map pushed via POST /map
    // from anywhere (another tab, a script, nova-nav-style tooling) without
    // adding a dedicated NATS subject for map-content itself.
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!map || map.nodes.length === 0) return null;

  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));

  return (
    <group>
      {map.edges.map((e) => {
        const a = nodeById.get(e.from);
        const b = nodeById.get(e.to);
        if (!a || !b) return null;
        return (
          <Line
            key={e.id}
            points={[toWorld(a.x, a.y, HEIGHT_MM), toWorld(b.x, b.y, HEIGHT_MM)]}
            color={EDGE_COLOR}
            lineWidth={2}
          />
        );
      })}
      {map.nodes.map((n) => (
        <mesh key={n.id} position={toWorld(n.x, n.y, HEIGHT_MM)}>
          <sphereGeometry args={[NODE_RADIUS_MM, 16, 16]} />
          <meshStandardMaterial color={NODE_COLOR} emissive={NODE_COLOR} emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}
