import raw from "./assets/rig-metadata.json";

export type LegName = "lf" | "lm" | "lh" | "rf" | "rm" | "rh";

export interface JointInfo {
  node: string;
  axis: [number, number, number];
}

export const GROUND_OFFSET_MM: number = raw.groundOffsetMm;
export const EXTENT_MM: [number, number, number] = raw.extentMm as [number, number, number];
// Angle (atan2(x, z) convention) of the rig's own bind-pose forward
// direction. The mesh does not necessarily face +Z at rotation.y=0, so this
// must be subtracted when turning the model to face its direction of
// travel, or it visually appears to strafe instead of walking forward.
export const FACING_OFFSET_RAD: number = raw.facingOffsetRad;
export const LEGS: Record<LegName, string[]> = raw.legs;
export const JOINTS: Record<string, JointInfo> = raw.joints as unknown as Record<string, JointInfo>;

const LEG_LEVEL_NODES: Record<"ThC" | "CTr" | "FTi" | "TiTa", (leg: LegName) => [string, string]> = {
  ThC: (leg) => ["c_thorax", `${leg}_coxa`],
  CTr: (leg) => [`${leg}_coxa`, `${leg}_trochanterfemur`],
  FTi: (leg) => [`${leg}_trochanterfemur`, `${leg}_tibia`],
  TiTa: (leg) => [`${leg}_tibia`, `${leg}_tarsus1`],
};

/**
 * Builds a joint name from its anatomical level + axis rather than relying
 * on array position in LEGS[leg] — different fly bodies define their DOFs in
 * different orders (e.g. flybody is ThC yaw/roll/pitch, NeuroMechFly is
 * yaw/pitch/roll), so positional destructuring would silently drive the
 * wrong joint if the underlying rig changes.
 */
export function legJointName(
  leg: LegName,
  level: "ThC" | "CTr" | "FTi" | "TiTa",
  axis: "yaw" | "roll" | "pitch",
): string {
  const [parent, child] = LEG_LEVEL_NODES[level](leg);
  return `${parent}-${child}-${axis}`;
}
