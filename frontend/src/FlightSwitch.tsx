interface FlightSwitchProps {
  flying: boolean;
  disabled: boolean;
  onToggle: () => void;
  size?: "normal" | "large";
}

export default function FlightSwitch({ flying, disabled, onToggle, size = "normal" }: FlightSwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={flying}
      disabled={disabled}
      onClick={onToggle}
      style={{
        padding: size === "large" ? "10px 20px" : "6px 14px",
        borderRadius: 6,
        border: flying ? "1px solid #8e56fc" : "1px solid #2a2d3a",
        background: flying ? "#8e56fc33" : "transparent",
        color: disabled ? "#5a5d6b" : "inherit",
        cursor: disabled ? "default" : "pointer",
        font: "inherit",
        fontSize: 13,
      }}
    >
      {flying ? "Flying — space to land" : "Walking — space to fly"}
    </button>
  );
}
