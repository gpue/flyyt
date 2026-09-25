import type { FlyInstanceData } from "./useFlyLayout";
import type { ConnectionState, LiveFlyState } from "./useLiveFlyState";

export const FLY_ICON = "\u{1FAB0}"; // 🪰, same icon used for the favicon

export const CONNECTION_COLOR: Record<ConnectionState, string> = {
  ONLINE: "#4ade80",
  OFFLINE: "#5a5d6b",
  CONNECTION_BROKEN: "#f87171",
  UNKNOWN: "#5a5d6b",
};

interface FlyRowProps {
  fly: FlyInstanceData;
  isSelected: boolean;
  live: Pick<LiveFlyState, "driving" | "operatingMode" | "batteryPercent" | "connectionState"> | undefined;
  onClick: () => void;
}

export default function FlyRow({ fly, isSelected, live, onClick }: FlyRowProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
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
            <span style={{ fontSize: 10, color: "#8b8d99" }}>{live.operatingMode === "AUTOMATIC" ? "driving" : "manual"}</span>
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
}
