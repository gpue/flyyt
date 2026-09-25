import { CONNECTION_COLOR, FLY_ICON } from "./FlyRow";
import type { FlyInstanceData } from "./useFlyLayout";
import type { StatusSnapshot } from "./useStatusSnapshot";

interface FlyChipStripProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  statusSnapshot: StatusSnapshot;
  onSelectFly: (id: string | null) => void;
}

// Compact horizontal chip row for the mobile sheet's always-visible
// collapsed handle bar -- a cut-down FlyRow: icon + short id + connection
// dot only. Driving/manual text and battery% are dropped here (low-signal
// at a glance) but stay visible in the full FlyList once the sheet expands.
export default function FlyChipStrip({ flies, selectedFlyId, statusSnapshot, onSelectFly }: FlyChipStripProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        flex: 1,
        minWidth: 0,
        padding: "0 8px",
      }}
    >
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
              gap: 6,
              flexShrink: 0,
              padding: "0 12px",
              height: 36,
              borderRadius: 18,
              cursor: "pointer",
              background: isSelected ? "#8e56fc33" : "#1d1f2b",
              border: isSelected ? "1px solid #8e56fc" : "1px solid #2a2d3a",
              color: "inherit",
              font: "inherit",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden="true">{FLY_ICON}</span>
            <span>Fly {fly.index + 1}</span>
            {live && live.connectionState !== "UNKNOWN" && (
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
            )}
          </button>
        );
      })}
    </div>
  );
}
