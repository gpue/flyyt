import { useState, type ChangeEvent } from "react";

const SIZES = {
  normal: { trackLength: 90, columnWidth: 24 },
  large: { trackLength: 130, columnWidth: 40 },
};

interface WingSliderProps {
  label: string;
  disabled: boolean;
  onChange: (value: number) => void;
  size?: "normal" | "large";
}

// A single vertical 0-1 slider (0 = folded rest pose, 1 = fully raised),
// rendered as a rotated standard range input rather than the non-standard
// (Firefox-only) `orient="vertical"` attribute.
export default function WingSlider({ label, disabled, onChange, size = "normal" }: WingSliderProps) {
  const [value, setValue] = useState(0);
  const { trackLength: TRACK_LENGTH, columnWidth: COLUMN_WIDTH } = SIZES[size];

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setValue(next);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: COLUMN_WIDTH, height: TRACK_LENGTH, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          style={{
            width: TRACK_LENGTH,
            transform: "rotate(-90deg)",
            accentColor: "#8e56fc",
            cursor: disabled ? "default" : "pointer",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#8b8d99" }}>{label}</span>
    </div>
  );
}
