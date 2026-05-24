export type RiskLevel = "high" | "med" | "low" | "none";

export default function RiskDot({ level, size = 8 }: { level: RiskLevel; size?: number }) {
  const color =
    level === "high"
      ? "var(--risk-high)"
      : level === "med"
        ? "var(--risk-med)"
        : level === "low"
          ? "var(--risk-low)"
          : "transparent";
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: level === "none" ? "1px solid var(--rule-strong)" : "none",
        flexShrink: 0,
      }}
    />
  );
}

/** Map the backend's RiskLevel string ("None"|"Low"|"Medium"|"High") to a dot level. */
export function toRiskLevel(value: string | null | undefined): RiskLevel {
  switch ((value ?? "").toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "med";
    case "low":
      return "low";
    default:
      return "none";
  }
}
