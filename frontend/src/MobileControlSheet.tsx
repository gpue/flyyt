import BrainActivity from "./BrainActivity";
import FlyChipStrip from "./FlyChipStrip";
import FlyControls from "./FlyControls";
import FlyList from "./FlyList";
import type { FlyInstanceData } from "./useFlyLayout";
import type { LiveFlyPositions } from "./useLiveFlyState";
import { useStatusSnapshot } from "./useStatusSnapshot";

// Exported so App.tsx can size the collapsed canvas as calc(100% - handle).
export const MOBILE_SHEET_HANDLE_HEIGHT = 48;

interface MobileControlSheetProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  onSelectFly: (id: string | null) => void;
  joystickRef: React.RefObject<{ x: number; y: number }>;
  wingSlidersRef: React.RefObject<{ left: number; right: number }>;
  livePositionsRef: React.RefObject<LiveFlyPositions>;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export default function MobileControlSheet({
  flies,
  selectedFlyId,
  onSelectFly,
  joystickRef,
  wingSlidersRef,
  livePositionsRef,
  expanded,
  onToggleExpanded,
}: MobileControlSheetProps) {
  const statusSnapshot = useStatusSnapshot(flies, livePositionsRef);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#14151d",
        borderTop: "1px solid #2a2d3a",
        fontFamily: "system-ui, sans-serif",
        color: "#d8dae0",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: MOBILE_SHEET_HANDLE_HEIGHT, flexShrink: 0 }}>
        <FlyChipStrip flies={flies} selectedFlyId={selectedFlyId} statusSnapshot={statusSnapshot} onSelectFly={onSelectFly} />
        <button
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse fly controls" : "Expand fly controls"}
          style={{
            width: 40,
            height: MOBILE_SHEET_HANDLE_HEIGHT,
            flexShrink: 0,
            background: "transparent",
            border: "none",
            borderLeft: "1px solid #2a2d3a",
            color: "#d8dae0",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {expanded ? "⌄" : "⌃"}
        </button>
      </div>

      {expanded && (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <FlyControls disabled={!selectedFlyId} joystickRef={joystickRef} wingSlidersRef={wingSlidersRef} size="large" />

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

          <FlyList flies={flies} selectedFlyId={selectedFlyId} statusSnapshot={statusSnapshot} onSelectFly={onSelectFly} />

          <BrainActivity selectedFlyId={selectedFlyId} livePositionsRef={livePositionsRef} />
        </div>
      )}
    </div>
  );
}
