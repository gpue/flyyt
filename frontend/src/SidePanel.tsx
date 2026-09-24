import type { FlyInstanceData } from "./useFlyLayout";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 36;

interface SidePanelProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  onSelectFly: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function SidePanel({
  flies,
  selectedFlyId,
  onSelectFly,
  collapsed,
  onToggleCollapsed,
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
        <div style={{ overflowY: "auto", padding: "8px 0" }} role="list">
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
                Fly {fly.index + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
