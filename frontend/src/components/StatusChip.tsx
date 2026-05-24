/** Bordered mono status pill, mapping the backend document status to a label + tone. */
type Tone = { label: string; c: string; bg: string; b: string; pulse?: boolean };

const MAP: Record<string, Tone> = {
  extracted: { label: "Ready", c: "var(--ink)", bg: "var(--paper-2)", b: "var(--rule-strong)" },
  processing: { label: "Processing", c: "var(--ink-2)", bg: "var(--paper-3)", b: "var(--rule-strong)", pulse: true },
  uploaded: { label: "Processing", c: "var(--ink-2)", bg: "var(--paper-3)", b: "var(--rule-strong)", pulse: true },
  failed: { label: "Failed", c: "var(--stamp-ink)", bg: "var(--stamp-soft)", b: "var(--stamp-ink)" },
  signed: { label: "Signed", c: "var(--stamp-ink)", bg: "var(--stamp-soft)", b: "var(--stamp-ink)" },
};

export default function StatusChip({ status }: { status: string }) {
  const m: Tone =
    MAP[status.toLowerCase()] ?? { label: status, c: "var(--ink)", bg: "var(--paper-2)", b: "var(--rule-strong)" };
  return (
    <span className="status-chip" style={{ color: m.c, background: m.bg, borderColor: m.b }}>
      {m.pulse && <span className="status-pulse" style={{ background: m.c }} />}
      {m.label}
    </span>
  );
}
