/** Bordered mono uppercase status pill. "Processing"-like states get a pulsing dot. */
export default function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const inProgress = ["processing", "uploaded", "pending", "translating", "analyzing"].includes(s);
  const signed = s === "signed";

  return (
    <span className={`badge-mono${signed ? " stamp" : ""}`}>
      {inProgress && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        />
      )}
      {status}
    </span>
  );
}
