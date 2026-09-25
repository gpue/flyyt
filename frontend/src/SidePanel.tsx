import { useEffect, useState } from "react";
import BrainActivity from "./BrainActivity";
import Joystick from "./Joystick";
import type { FlyInstanceData } from "./useFlyLayout";
import type { ConnectionState, LiveFlyPositions, LiveFlyState } from "./useLiveFlyState";
import WingSlider from "./WingSlider";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 36;
const FLY_ICON = "\u{1FAB0}"; // 🪰, same icon used for the favicon

const CONNECTION_COLOR: Record<ConnectionState, string> = {
  ONLINE: "#4ade80",
  OFFLINE: "#5a5d6b",
  CONNECTION_BROKEN: "#f87171",
  UNKNOWN: "#5a5d6b",
};

type StatusSnapshot = Map<string, Pick<LiveFlyState, "driving" | "operatingMode" | "batteryPercent" | "connectionState">>;

/** Snapshots the fly list's status readout periodically into React state --
 * status lives in livePositionsRef (mutated imperatively by
 * useVda5050Nats.ts, no React state of its own by design, same as
 * everywhere else in this app), so a plain DOM component like this one
 * needs its own light poll to notice changes; matches vda5050-sim's own
 * status UI's polling approach. The snapshot is built here (an effect
 * callback, not render) so the render itself only ever reads state, never
 * the ref directly. */
function useStatusSnapshot(flies: FlyInstanceData[], livePositionsRef: React.RefObject<LiveFlyPositions>): StatusSnapshot {
  const [snapshot, setSnapshot] = useState<StatusSnapshot>(() => new Map());
  useEffect(() => {
    const id = setInterval(() => {
      const next: StatusSnapshot = new Map();
      for (const fly of flies) {
        const live = livePositionsRef.current.get(fly.id);
        if (live) {
          next.set(fly.id, {
            driving: live.driving,
            operatingMode: live.operatingMode,
            batteryPercent: live.batteryPercent,
            connectionState: live.connectionState,
          });
        }
      }
      setSnapshot(next);
    }, 500);
    return () => clearInterval(id);
  }, [flies, livePositionsRef]);
  return snapshot;
}

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
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0" }} role="list">
          {flies.map((fly) => {
            const isSelected = fly.id === selectedFlyId;
            const live = statusSnapshot.get(fly.id);
            return (
              <button
                key={fly.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectFly(isSelected ? null : fly.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
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
                <span>Fly {fly.index + 1}</span>
                {live && live.connectionState !== "UNKNOWN" && (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    {live.driving && (
                      <span style={{ fontSize: 10, color: "#8b8d99" }}>
                        {live.operatingMode === "AUTOMATIC" ? "driving" : "manual"}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "#8b8d99" }}>{Math.round(live.batteryPercent)}%</span>
                    <span
                      aria-hidden="true"
                      title={live.connectionState}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: CONNECTION_COLOR[live.connectionState],
                        flexShrink: 0,
                      }}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!collapsed && <BrainActivity selectedFlyId={selectedFlyId} livePositionsRef={livePositionsRef} />}
    </div>
  );
}
