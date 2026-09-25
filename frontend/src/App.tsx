import { useEffect, useRef, useState } from "react";
import { ALTITUDE_LEVELS_MM } from "./altitudeLevels";
import { apiPath } from "./env";
import FlyScene from "./FlyScene";
import { resumeAudioContext } from "./flyBuzz";
import MobileControlSheet, { MOBILE_SHEET_HANDLE_HEIGHT } from "./MobileControlSheet";
import SidePanel from "./SidePanel";
import { FLY_GROUND_OFFSET_MM, useFlyLayout } from "./useFlyLayout";
import { useIsMobile } from "./useIsMobile";
import { useKeyboardControls } from "./useKeyboardControls";
import { useLiveFlyState } from "./useLiveFlyState";
import { useVda5050Nats } from "./vda5050/useVda5050Nats";

/** Every backend-connected fly defaults to VDA5050 operatingMode AUTOMATIC
 * (even idle, order-less ones) -- FlyInstances.tsx only lets the local
 * joystick move a fly when it's NOT AUTOMATIC, so without this, selecting a
 * fly while a backend is connected would silently make the joystick do
 * nothing. Tells the backend a fly is now under local/manual control on
 * select, and hands it back on deselect (a no-op, harmlessly ignored, when
 * there's no backend to reach). */
function setManualMode(flyId: string, manual: boolean): void {
  fetch(apiPath(`fly/${flyId}/manual?manual=${manual}`), { method: "POST" }).catch(() => {});
}

export default function App() {
  const flies = useFlyLayout();
  const livePositionsRef = useLiveFlyState(flies);
  useVda5050Nats(livePositionsRef);
  const joystickRef = useRef({ x: 0, y: 0 });
  const wingSlidersRef = useRef({ left: 0, right: 0 });
  const [selectedFlyId, setSelectedFlyId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [flying, setFlying] = useState(false);
  const [altitudeLevelIndex, setAltitudeLevelIndex] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!selectedFlyId) return;
    setManualMode(selectedFlyId, true);
    return () => setManualMode(selectedFlyId, false);
  }, [selectedFlyId]);

  // Selecting a fly -- whether via a chip in the mobile sheet or tapping it
  // directly in the 3D scene -- surfaces its controls (and squeezes the
  // canvas to make room), same as the desktop panel already keeps its
  // controls visible/enabled once something's selected. Only squeeze the
  // canvas when there's something to show; an empty selection never forces
  // the sheet open on its own.
  useEffect(() => {
    if (selectedFlyId) setSheetExpanded(true);
  }, [selectedFlyId]);

  // Syncs the flight switch/altitude slider's UI state onto whichever fly is
  // selected, same shape as setManualMode above (body applies, cleanup
  // reverts) -- the cleanup is what auto-lands a flying fly the moment you
  // deselect it or select a different one, rather than leaving it hovering
  // unattended with no visible control surface.
  useEffect(() => {
    if (!selectedFlyId) return;
    const live = livePositionsRef.current.get(selectedFlyId);
    if (live) {
      live.flying = flying;
      live.targetAltitudeMm = flying ? ALTITUDE_LEVELS_MM[altitudeLevelIndex] : FLY_GROUND_OFFSET_MM;
    }
    return () => {
      const prevLive = livePositionsRef.current.get(selectedFlyId);
      if (prevLive) {
        prevLive.flying = false;
        prevLive.targetAltitudeMm = FLY_GROUND_OFFSET_MM;
      }
    };
  }, [flying, altitudeLevelIndex, selectedFlyId, livePositionsRef]);

  // Freshly selecting a different fly always shows it as grounded in the
  // switch/slider, matching the auto-land-on-deselect behavior above.
  useEffect(() => {
    setFlying(false);
    setAltitudeLevelIndex(0);
  }, [selectedFlyId]);

  const toggleFlying = () => setFlying((f) => !f);
  const onAltitudeChange = (index: number) => {
    setAltitudeLevelIndex(Math.min(ALTITUDE_LEVELS_MM.length - 1, Math.max(0, index)));
    // Changing altitude implies airborne; landing is only ever via the
    // switch/Space, not by stepping back down past level 0.
    setFlying(true);
  };
  const onAltitudeStep = (direction: 1 | -1) => onAltitudeChange(altitudeLevelIndex + direction);

  useKeyboardControls({ selectedFlyId, joystickRef, onToggleFlying: toggleFlying, onAltitudeStep });

  return (
    // Buzzing audio needs a user gesture to start (browser autoplay policy);
    // this covers every click/tap anywhere in the app rather than needing a
    // dedicated "enable sound" button. dvw/dvh (not vw/vh) so mobile browser
    // chrome showing/hiding doesn't clip content or leave a jumpy gap.
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        width: "100dvw",
        height: "100dvh",
      }}
      onPointerDown={() => resumeAudioContext()}
    >
      <div
        style={
          isMobile
            ? {
                height: sheetExpanded ? "50dvh" : `calc(100dvh - ${MOBILE_SHEET_HANDLE_HEIGHT}px)`,
                width: "100%",
                flexShrink: 0,
                transition: "height 200ms ease",
              }
            : { flex: 1, minWidth: 0, height: "100%" }
        }
      >
        <FlyScene
          flies={flies}
          selectedFlyId={selectedFlyId}
          onSelectFly={setSelectedFlyId}
          livePositionsRef={livePositionsRef}
          joystickRef={joystickRef}
          wingSlidersRef={wingSlidersRef}
        />
      </div>
      {isMobile ? (
        <div
          style={{
            height: sheetExpanded ? "50dvh" : MOBILE_SHEET_HANDLE_HEIGHT,
            width: "100%",
            flexShrink: 0,
            transition: "height 200ms ease",
          }}
        >
          <MobileControlSheet
            flies={flies}
            selectedFlyId={selectedFlyId}
            onSelectFly={setSelectedFlyId}
            joystickRef={joystickRef}
            wingSlidersRef={wingSlidersRef}
            livePositionsRef={livePositionsRef}
            expanded={sheetExpanded}
            onToggleExpanded={() => setSheetExpanded((e) => !e)}
            flying={flying}
            onToggleFlying={toggleFlying}
            altitudeLevelIndex={altitudeLevelIndex}
            onAltitudeChange={onAltitudeChange}
          />
        </div>
      ) : (
        <SidePanel
          flies={flies}
          selectedFlyId={selectedFlyId}
          onSelectFly={setSelectedFlyId}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
          joystickRef={joystickRef}
          wingSlidersRef={wingSlidersRef}
          livePositionsRef={livePositionsRef}
          flying={flying}
          onToggleFlying={toggleFlying}
          altitudeLevelIndex={altitudeLevelIndex}
          onAltitudeChange={onAltitudeChange}
        />
      )}
    </div>
  );
}
