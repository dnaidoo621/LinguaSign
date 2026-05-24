"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import { useUser } from "@/lib/useUser";
import type {
  AnalysisDetail,
  ClauseFindingDto,
  DocumentDetail,
  TranslationDetail,
} from "@/lib/types";
import TranslationPanel from "@/components/TranslationPanel";
import SignAndExport from "@/components/SignAndExport";

// react-pdf is browser-only — load without SSR.
const PdfBlockViewer = dynamic(() => import("@/components/PdfBlockViewer"), {
  ssr: false,
});

const TARGET = "en";

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useUser();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [translation, setTranslation] = useState<TranslationDetail | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const translatePoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    apiJson<DocumentDetail>(`/api/documents/${id}`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, [id, user]);

  useEffect(() => {
    if (!user) return;
    apiJson<TranslationDetail>(`/api/documents/${id}/translation?target=${TARGET}`)
      .then(setTranslation)
      .catch(() => {});
    apiJson<AnalysisDetail>(`/api/documents/${id}/analysis`)
      .then(setAnalysis)
      .catch(() => {});
  }, [id, user]);

  // Poll translation while in progress.
  const tStatus = translation?.status;
  useEffect(() => {
    if (tStatus !== "Pending" && tStatus !== "Translating") return;
    translatePoll.current = setInterval(async () => {
      try {
        setTranslation(await apiJson<TranslationDetail>(`/api/documents/${id}/translation?target=${TARGET}`));
      } catch {}
    }, 2000);
    return () => {
      if (translatePoll.current) clearInterval(translatePoll.current);
    };
  }, [tStatus, id]);

  // Poll analysis while in progress.
  const aStatus = analysis?.status;
  useEffect(() => {
    if (aStatus !== "Pending" && aStatus !== "Analyzing") return;
    analysisPoll.current = setInterval(async () => {
      try {
        setAnalysis(await apiJson<AnalysisDetail>(`/api/documents/${id}/analysis`));
      } catch {}
    }, 2500);
    return () => {
      if (analysisPoll.current) clearInterval(analysisPoll.current);
    };
  }, [aStatus, id]);

  const translate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/documents/${id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: TARGET }),
      });
      setTranslation(await apiJson<TranslationDetail>(`/api/documents/${id}/translation?target=${TARGET}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed to start.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  const analyze = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/documents/${id}/analyze`, { method: "POST" });
      setAnalysis(await apiJson<AnalysisDetail>(`/api/documents/${id}/analysis`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed to start.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  const findingsByBlock = useMemo(() => {
    const map: Record<string, ClauseFindingDto> = {};
    for (const f of analysis?.findings ?? []) map[f.sourceBlockId] = f;
    return map;
  }, [analysis]);

  const riskByBlock = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of analysis?.findings ?? []) {
      if (f.riskLevel !== "None") map[f.sourceBlockId] = f.riskLevel;
    }
    return map;
  }, [analysis]);

  if (loading) return <main className="p-8 text-sm text-gray-500">Loading…</main>;
  if (!user)
    return (
      <main className="p-8 text-sm">
        Please <Link href="/dashboard" className="underline">sign in</Link>.
      </main>
    );

  const isTranslating = tStatus === "Pending" || tStatus === "Translating";
  const translationDone = tStatus === "Completed";
  const isAnalyzing = aStatus === "Pending" || aStatus === "Analyzing";
  const analysisDone = aStatus === "Completed";

  const highRisks = (analysis?.findings ?? []).filter((f) => f.riskLevel === "High");
  const mediumRisks = (analysis?.findings ?? []).filter((f) => f.riskLevel === "Medium");

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <Link href="/dashboard" className="text-sm text-blue-600 underline">
        ← Back
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!detail && !error && <p className="text-sm text-gray-500">Loading document…</p>}

      {detail && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{detail.fileName}</h1>
              <p className="text-sm text-gray-500">
                {detail.pageCount} pages
                {detail.sourceLanguage ? ` · detected: ${detail.sourceLanguage}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isTranslating && (
                <span className="text-sm text-gray-500" data-testid="translation-status">
                  Translating…
                </span>
              )}
              {isAnalyzing && (
                <span className="text-sm text-gray-500" data-testid="analysis-status">
                  Analyzing risks…
                </span>
              )}
              <button
                data-testid="translate-button"
                onClick={translate}
                disabled={busy || isTranslating}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {translationDone ? "Re-translate" : "Translate to English"}
              </button>
              <button
                data-testid="analyze-button"
                onClick={analyze}
                disabled={busy || isAnalyzing}
                className="rounded-full border border-black px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                {analysisDone ? "Re-analyze risks" : "Analyze risks"}
              </button>
            </div>
          </header>

          <p className="text-xs text-gray-400">
            Hover a block or a translated clause to highlight its counterpart. AI translation and
            risk analysis — not certified or legal advice.
          </p>

          {analysisDone && (
            <section
              data-testid="risk-summary"
              className="rounded-lg border border-gray-200 p-4"
            >
              <h2 className="text-sm font-semibold">
                Risk summary{" "}
                <span className="font-normal text-gray-500">
                  ({highRisks.length} high, {mediumRisks.length} medium)
                </span>
              </h2>
              {highRisks.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">No high-risk clauses detected.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {highRisks.map((f) => (
                    <li key={f.sourceBlockId} data-testid="high-risk-item" className="text-sm">
                      <span className="mr-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                        {f.riskType}
                      </span>
                      <span className="text-gray-700">{f.explanation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-auto">
              <PdfBlockViewer
                detail={detail}
                pageWidth={520}
                activeBlock={activeBlock}
                onHover={setActiveBlock}
                riskByBlock={riskByBlock}
              />
            </div>
            <div className="overflow-auto" data-testid="translation-pane">
              {translationDone && translation ? (
                <TranslationPanel
                  translation={translation}
                  activeBlock={activeBlock}
                  onHover={setActiveBlock}
                  findingsByBlock={findingsByBlock}
                />
              ) : (
                <p className="text-sm text-gray-400">
                  {isTranslating
                    ? "Translating the document clause by clause…"
                    : "Click “Translate to English” to generate a synchronized translation."}
                </p>
              )}
            </div>
          </div>

          <SignAndExport documentId={detail.id} fileName={detail.fileName} />
        </>
      )}
    </main>
  );
}
