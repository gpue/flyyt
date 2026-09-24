import { useState } from "react";
import FlyScene from "./FlyScene";
import SidePanel from "./SidePanel";
import { useFlyLayout } from "./useFlyLayout";

export default function App() {
  const flies = useFlyLayout();
  const [selectedFlyId, setSelectedFlyId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div style={{ flex: 1, minWidth: 0, height: "100%" }}>
        <FlyScene flies={flies} selectedFlyId={selectedFlyId} />
      </div>
      <SidePanel
        flies={flies}
        selectedFlyId={selectedFlyId}
        onSelectFly={setSelectedFlyId}
        collapsed={panelCollapsed}
        onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
      />
    </div>
  );
}
