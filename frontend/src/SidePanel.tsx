import BrainActivity from "./BrainActivity";
import FlyControls from "./FlyControls";
import FlyList from "./FlyList";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";
import { useStatusSnapshot } from "./useStatusSnapshot";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 36;

interface SidePanelProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  onSelectFly: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
  flying: boolean;
  onToggleFlying: () => void;
  altitudeLevelIndex: number;
  onAltitudeChange: (index: number) => void;
}

export default function SidePanel({
  flies,
  selectedFlyId,
  onSelectFly,
  collapsed,
  onToggleCollapsed,
  joystickRef,
  wingSlidersRef,
  livePositionsRef,
  flying,
  onToggleFlying,
  altitudeLevelIndex,
  onAltitudeChange,
}: SidePanelProps) {
  const statusSnapshot = useStatusSnapshot(flies, livePositionsRef);

  return (
    <div
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        flexShrink: 0,
        height: "100%",
        overflow: "hidden",
        transition: "width 200ms ease",
        background: "#14151d",
        borderLeft: "1px solid #2a2d3a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        color: "#d8dae0",
      }}
    >
      <button
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand fly list" : "Collapse fly list"}
        style={{
          width: COLLAPSED_WIDTH,
          height: 40,
          flexShrink: 0,
          background: "transparent",
          border: "none",
          borderBottom: "1px solid #2a2d3a",
          color: "#d8dae0",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        {collapsed ? "‹" : "›"}
      </button>

      {!collapsed && (
        <FlyControls
          disabled={!selectedFlyId}
          joystickRef={joystickRef}
          wingSlidersRef={wingSlidersRef}
          flying={flying}
          onToggleFlying={onToggleFlying}
          altitudeLevelIndex={altitudeLevelIndex}
          onAltitudeChange={onAltitudeChange}
        />
      )}

      {!collapsed && (
        <button
          type="button"
          onClick={() => onSelectFly(null)}
          disabled={!selectedFlyId}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "8px 16px",
            cursor: selectedFlyId ? "pointer" : "default",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid #2a2d3a",
            color: selectedFlyId ? "inherit" : "#5a5d6b",
            font: "inherit",
            fontSize: 13,
          }}
        >
          ✕ Deselect
        </button>
      )}

      {!collapsed && (
        <FlyList flies={flies} selectedFlyId={selectedFlyId} statusSnapshot={statusSnapshot} onSelectFly={onSelectFly} />
      )}

      {!collapsed && <BrainActivity selectedFlyId={selectedFlyId} livePositionsRef={livePositionsRef} />}
    </div>
  );
}
