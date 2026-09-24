import BrainActivity from "./BrainActivity";
import Joystick from "./Joystick";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";
import WingSlider from "./WingSlider";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 36;
const FLY_ICON = "\u{1FAB0}"; // 🪰, same icon used for the favicon

interface SidePanelProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  onSelectFly: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
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
}: SidePanelProps) {
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
            disabled={!selectedFlyId}
            onChange={(v) => {
              wingSlidersRef.current.left = v;
            }}
          />
          <Joystick vectorRef={joystickRef} disabled={!selectedFlyId} />
          <WingSlider
            label="R wing"
            disabled={!selectedFlyId}
            onChange={(v) => {
              wingSlidersRef.current.right = v;
            }}
          />
        </div>
      )}

      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0" }} role="list">
          {flies.map((fly) => {
            const isSelected = fly.id === selectedFlyId;
            return (
              <button
                key={fly.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectFly(isSelected ? null : fly.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  cursor: "pointer",
                  background: isSelected ? "#8e56fc33" : "transparent",
                  border: "none",
                  borderLeft: isSelected ? "3px solid #8e56fc" : "3px solid transparent",
                  color: "inherit",
                  font: "inherit",
                  fontSize: 14,
                }}
              >
                <span aria-hidden="true" style={{ marginRight: 8 }}>
                  {FLY_ICON}
                </span>
                Fly {fly.index + 1}
              </button>
            );
          })}
        </div>
      )}

      {!collapsed && <BrainActivity selectedFlyId={selectedFlyId} livePositionsRef={livePositionsRef} />}
    </div>
  );
}
