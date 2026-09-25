import { useEffect, useRef, useState } from "react";
import { apiPath } from "./env";
import FlyScene from "./FlyScene";
import { resumeAudioContext } from "./flyBuzz";
import SidePanel from "./SidePanel";
import { useFlyLayout } from "./useFlyLayout";
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

  useEffect(() => {
    if (!selectedFlyId) return;
    setManualMode(selectedFlyId, true);
    return () => setManualMode(selectedFlyId, false);
  }, [selectedFlyId]);

  return (
    // Buzzing audio needs a user gesture to start (browser autoplay policy);
    // this covers every click/tap anywhere in the app rather than needing a
    // dedicated "enable sound" button.
    <div style={{ display: "flex", width: "100vw", height: "100vh" }} onPointerDown={() => resumeAudioContext()}>
      <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
        <FlyScene
          flies={flies}
          selectedFlyId={selectedFlyId}
          onSelectFly={setSelectedFlyId}
          livePositionsRef={livePositionsRef}
          joystickRef={joystickRef}
          wingSlidersRef={wingSlidersRef}
        />
      </div>
      <SidePanel
        flies={flies}
        selectedFlyId={selectedFlyId}
        onSelectFly={setSelectedFlyId}
        collapsed={panelCollapsed}
        onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
        joystickRef={joystickRef}
        wingSlidersRef={wingSlidersRef}
        livePositionsRef={livePositionsRef}
      />
    </div>
  );
}
