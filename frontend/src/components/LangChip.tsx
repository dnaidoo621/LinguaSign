const GLYPH: Record<string, string> = { ko: "한", zh: "中", ja: "日", en: "EN" };

export default function LangChip({ from, to }: { from: string; to: string }) {
  const fromFont =
    from === "ko" ? "Noto Serif KR, serif" : from === "zh" ? "Noto Serif SC, serif" : "var(--serif)";
  return (
    <span
      className="row"
      style={{ gap: 6, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-3)" }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          border: "1px solid var(--rule-strong)",
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          fontFamily: fromFont,
          fontSize: 13,
          color: "var(--ink)",
        }}
      >
        {GLYPH[from] ?? from}
      </span>
      <span style={{ opacity: 0.5 }}>→</span>
      <span
        style={{
          width: 22,
          height: 22,
          border: "1px solid var(--rule-strong)",
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          fontSize: 9,
          color: "var(--ink)",
        }}
      >
        {GLYPH[to] ?? to}
      </span>
    </span>
  );
}
