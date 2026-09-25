import { useEffect, useRef } from "react";

interface KeyboardControlsArgs {
  selectedFlyId: string | null;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  onToggleFlying: () => void;
  onAltitudeStep: (direction: 1 | -1) => void;
}

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// Keyboard alternative to Joystick.tsx's pointer drag (arrow keys) and the
// flight switch/altitude slider (Space, +/-) -- writes straight into the same
// joystickRef the pointer joystick writes to, so FlyInstances.tsx needs no
// awareness of where a command came from.
export function useKeyboardControls({ selectedFlyId, joystickRef, onToggleFlying, onAltitudeStep }: KeyboardControlsArgs) {
  const heldRef = useRef(new Set<string>());
  // Latest-callback refs: onToggleFlying/onAltitudeStep are fresh closures
  // every App render (they're not memoized there), but flying/altitude
  // changes are themselves state updates that would otherwise re-run this
  // effect and clearAll() the joystick mid-press. Keeping only
  // selectedFlyId/joystickRef as real effect deps means listener
  // registration only churns on an actual selection change.
  const onToggleFlyingRef = useRef(onToggleFlying);
  onToggleFlyingRef.current = onToggleFlying;
  const onAltitudeStepRef = useRef(onAltitudeStep);
  onAltitudeStepRef.current = onAltitudeStep;

  useEffect(() => {
    const applyFromHeld = () => {
      const held = heldRef.current;
      let x = 0;
      let y = 0;
      if (held.has("ArrowUp")) y += 1;
      if (held.has("ArrowDown")) y -= 1;
      if (held.has("ArrowLeft")) x -= 1;
      if (held.has("ArrowRight")) x += 1;
      const mag = Math.hypot(x, y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
      joystickRef.current.x = x;
      joystickRef.current.y = y;
    };

    const clearAll = () => {
      heldRef.current.clear();
      joystickRef.current.x = 0;
      joystickRef.current.y = 0;
    };

    // Selection changed -- don't let a key held before switching flies stick.
    clearAll();
    if (!selectedFlyId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (ARROW_KEYS.has(e.key)) {
        e.preventDefault();
        heldRef.current.add(e.key);
        applyFromHeld();
      } else if (e.code === "Space") {
        e.preventDefault();
        onToggleFlyingRef.current();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        onAltitudeStepRef.current(1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        onAltitudeStepRef.current(-1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (ARROW_KEYS.has(e.key)) {
        e.preventDefault();
        heldRef.current.delete(e.key);
        applyFromHeld();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAll);
      clearAll();
    };
  }, [selectedFlyId, joystickRef]);
}
