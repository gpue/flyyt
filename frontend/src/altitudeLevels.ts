import { FLY_EXTENT_MM, FLY_GROUND_OFFSET_MM } from "./useFlyLayout";

// A clearly readable hop between levels, scaled off the fly's own body size
// rather than a fixed mm constant so it stays proportionate if that changes.
const LEVEL_STEP_MM = Math.max(...FLY_EXTENT_MM) * 2.5;

export const ALTITUDE_LEVELS_MM = [1, 2, 3].map((n) => FLY_GROUND_OFFSET_MM + n * LEVEL_STEP_MM);
