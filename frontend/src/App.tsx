import { useRef, useState } from "react";
import FlyScene from "./FlyScene";
import SidePanel from "./SidePanel";
import { useFlyLayout } from "./useFlyLayout";
import { useLiveFlyState } from "./useLiveFlyState";

export default function App() {
  const flies = useFlyLayout();
  const livePositionsRef = useLiveFlyState(flies);
  const joystickRef = useRef({ x: 0, y: 0 });
  const wingSlidersRef = useRef({ left: 0, right: 0 });
  const [selectedFlyId, setSelectedFlyId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
        <FlyScene
          flies={flies}
          selectedFlyId={selectedFlyId}
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
