import type { ChangeEvent } from "react";
import { ALTITUDE_LEVELS_MM } from "./altitudeLevels";

const SIZES = {
  normal: { trackLength: 90 },
  large: { trackLength: 130 },
};

interface AltitudeSliderProps {
  levelIndex: number;
  disabled: boolean;
  onChange: (index: number) => void;
  size?: "normal" | "large";
}

// Horizontal, discrete-step counterpart to WingSlider.tsx's rotated
// continuous slider -- steps between altitudeLevels.ts's fixed height levels
// rather than a free-drag 0-1 range.
export default function AltitudeSlider({ levelIndex, disabled, onChange, size = "normal" }: AltitudeSliderProps) {
  const { trackLength: TRACK_LENGTH } = SIZES[size];

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <input
        type="range"
        min={0}
        max={ALTITUDE_LEVELS_MM.length - 1}
        step={1}
        value={levelIndex}
        disabled={disabled}
        onChange={handleChange}
        style={{
          width: TRACK_LENGTH,
          accentColor: "#8e56fc",
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <span style={{ fontSize: 11, color: "#8b8d99" }}>altitude</span>
    </div>
  );
}
