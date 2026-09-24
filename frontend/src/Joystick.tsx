import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const BASE_SIZE = 96;
const KNOB_SIZE = 36;
const RADIUS = (BASE_SIZE - KNOB_SIZE) / 2;

interface JoystickProps {
  vectorRef: React.RefObject<{ x: number; y: number }>;
  disabled: boolean;
}

export default function Joystick({ vectorRef, disabled }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const updateFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    vectorRef.current.x = dx / RADIUS;
    vectorRef.current.y = -dy / RADIUS; // screen-up -> positive y
  };

  const reset = () => {
    draggingRef.current = false;
    setKnob({ x: 0, y: 0 });
    vectorRef.current.x = 0;
    vectorRef.current.y = 0;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    updateFromPointer(e);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromPointer(e);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div
        ref={baseRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={reset}
        onPointerCancel={reset}
        style={{
          position: "relative",
          width: BASE_SIZE,
          height: BASE_SIZE,
          borderRadius: "50%",
          background: "#1d1f2b",
          border: "1px solid #2a2d3a",
          touchAction: "none",
          cursor: disabled ? "default" : "grab",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: BASE_SIZE / 2 - KNOB_SIZE / 2 + knob.x,
            top: BASE_SIZE / 2 - KNOB_SIZE / 2 + knob.y,
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: "50%",
            background: disabled ? "#4a4d5a" : "#8e56fc",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#8b8d99" }}>
        {disabled ? "select a fly to drive it" : "drag to walk"}
      </span>
    </div>
  );
}
