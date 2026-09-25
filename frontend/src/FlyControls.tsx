import AltitudeSlider from "./AltitudeSlider";
import FlightSwitch from "./FlightSwitch";
import Joystick from "./Joystick";
import WingSlider from "./WingSlider";

interface FlyControlsProps {
  disabled: boolean;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  flying: boolean;
  onToggleFlying: () => void;
  altitudeLevelIndex: number;
  onAltitudeChange: (index: number) => void;
  size?: "normal" | "large";
}

export default function FlyControls({
  disabled,
  joystickRef,
  wingSlidersRef,
  flying,
  onToggleFlying,
  altitudeLevelIndex,
  onAltitudeChange,
  size = "normal",
}: FlyControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "16px 0",
        borderBottom: "1px solid #2a2d3a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <WingSlider
          label="L wing"
          disabled={disabled}
          size={size}
          onChange={(v) => {
            wingSlidersRef.current.left = v;
          }}
        />
        <Joystick vectorRef={joystickRef} disabled={disabled} size={size} />
        <WingSlider
          label="R wing"
          disabled={disabled}
          size={size}
          onChange={(v) => {
            wingSlidersRef.current.right = v;
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <FlightSwitch flying={flying} disabled={disabled} onToggle={onToggleFlying} size={size} />
        {flying && (
          <AltitudeSlider levelIndex={altitudeLevelIndex} disabled={disabled} onChange={onAltitudeChange} size={size} />
        )}
      </div>
    </div>
  );
}
