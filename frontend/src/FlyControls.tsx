import Joystick from "./Joystick";
import WingSlider from "./WingSlider";

interface FlyControlsProps {
  disabled: boolean;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  size?: "normal" | "large";
}

export default function FlyControls({ disabled, joystickRef, wingSlidersRef, size = "normal" }: FlyControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid #2a2d3a",
      }}
    >
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
  );
}
