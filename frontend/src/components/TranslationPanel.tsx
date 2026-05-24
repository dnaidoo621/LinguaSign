"use client";

import type { ClauseFindingDto, TranslationDetail, TranslationSegmentDto } from "@/lib/types";

const RISK_BADGE: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-orange-100 text-orange-700",
  Low: "bg-yellow-100 text-yellow-700",
};

export default function TranslationPanel({
  translation,
  activeBlock,
  onHover,
  findingsByBlock,
}: {
  translation: TranslationDetail;
  activeBlock: string | null;
  onHover: (id: string | null) => void;
  findingsByBlock?: Record<string, ClauseFindingDto>;
}) {
  // Group segments by page, preserving order.
  const pages = new Map<number, TranslationSegmentDto[]>();
  for (const s of translation.segments) {
    const arr = pages.get(s.pageNumber) ?? [];
    arr.push(s);
    pages.set(s.pageNumber, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...pages.entries()].map(([pageNum, segs]) => (
        <div key={pageNum} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Page {pageNum}
          </p>
          {segs.map((s) => {
            const finding = findingsByBlock?.[s.sourceBlockId];
            const risky = finding && finding.riskLevel !== "None";
            return (
              <div
                key={s.sourceBlockId}
                data-testid="translation-segment"
                onMouseEnter={() => onHover(s.sourceBlockId)}
                onMouseLeave={() => onHover(null)}
                className={`cursor-default rounded-md border p-2.5 transition-colors ${
                  activeBlock === s.sourceBlockId
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {risky && (
                  <span
                    data-testid="risk-badge"
                    className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      RISK_BADGE[finding.riskLevel] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {finding.riskLevel} · {finding.riskType}
                  </span>
                )}
                <p className="text-sm text-gray-900">{s.translatedText}</p>
                {finding?.explanation && (
                  <p className="mt-1 text-xs italic text-gray-500">💡 {finding.explanation}</p>
                )}
                <p className="mt-1 border-t border-gray-100 pt-1 text-xs text-gray-400">
                  {s.sourceText}
                </p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
