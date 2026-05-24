"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiJson } from "@/lib/api";
import type { AnalysisDetail, DocumentDetail, DocumentSummary, TranslationDetail } from "@/lib/types";
import ProcessingPipeline from "./ProcessingPipeline";

type Stage = "idle" | "dragging" | "processing" | "done" | "error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState(0);
  const [docId, setDocId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ clauses: 0, high: 0 });

  useEffect(() => () => { cancelled.current = true; }, []);

  const pollDoc = useCallback(async (id: string) => {
    for (let i = 0; i < 150 && !cancelled.current; i++) {
      const d = await apiJson<DocumentDetail>(`/api/documents/${id}`);
      if (d.status === "Extracted") return d;
      if (d.status === "Failed") throw new Error(d.error || "Extraction failed.");
      await sleep(2000);
    }
    throw new Error("OCR timed out.");
  }, []);

  const pollTranslation = useCallback(async (id: string) => {
    for (let i = 0; i < 180 && !cancelled.current; i++) {
      const t = await apiJson<TranslationDetail>(`/api/documents/${id}/translation?target=en`);
      if (t.status === "Completed") return t;
      if (t.status === "Failed") throw new Error(t.error || "Translation failed.");
      await sleep(2500);
    }
    throw new Error("Translation timed out.");
  }, []);

  const pollAnalysis = useCallback(async (id: string) => {
    for (let i = 0; i < 180 && !cancelled.current; i++) {
      const a = await apiJson<AnalysisDetail>(`/api/documents/${id}/analysis`);
      if (a.status === "Completed") return a;
      if (a.status === "Failed") throw new Error(a.error || "Analysis failed.");
      await sleep(2500);
    }
    throw new Error("Analysis timed out.");
  }, []);

  const run = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please choose a PDF file.");
        setStage("idle");
        return;
      }
      cancelled.current = false;
      setError(null);
      setFileName(file.name);
      setStage("processing");
      setStep(0);

      try {
        // [01] UPLOAD
        const form = new FormData();
        form.append("file", file);
        const summary = await apiJson<DocumentSummary>("/api/documents", { method: "POST", body: form });
        setDocId(summary.id);
        onUploaded();

        // [02] OCR / [03] SEGMENT
        setStep(1);
        await pollDoc(summary.id);

        // [04] TRANSLATE
        setStep(3);
        await apiFetch(`/api/documents/${summary.id}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage: "en" }),
        });
        const tr = await pollTranslation(summary.id);

        // [05] ANALYZE
        setStep(4);
        await apiFetch(`/api/documents/${summary.id}/analyze`, { method: "POST" });
        const an = await pollAnalysis(summary.id);

        // [06] READY
        setCounts({
          clauses: tr.segments.length,
          high: an.findings.filter((f) => f.riskLevel === "High").length,
        });
        setStep(5);
        setStage("done");
        onUploaded();
      } catch (e) {
        if ((e as Error).message?.includes("cancel")) return;
        setError(e instanceof Error ? e.message : "Processing failed.");
        setStage("error");
      }
    },
    [onUploaded, pollDoc, pollTranslation, pollAnalysis],
  );

  const reset = () => {
    cancelled.current = true;
    setStage("idle");
    setStep(0);
    setError(null);
    setDocId(null);
  };

  return (
    <section>
      <div className="section-eyebrow solo" style={{ marginBottom: 14 }}>
        <span>NEW · UPLOAD</span>
        <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        <span>WORKSPACE</span>
      </div>
      <h2 className="upload-title">
        Drop a <em>contract</em>. We&apos;ll do the rest.
      </h2>

      {stage === "idle" || stage === "dragging" ? (
        <>
          <div
            className={"dropzone " + (stage === "dragging" ? "dragging" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setStage("dragging");
            }}
            onDragLeave={() => setStage("idle")}
            onDrop={(e) => {
              e.preventDefault();
              setStage("idle");
              const f = e.dataTransfer.files?.[0];
              if (f) void run(f);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <div className="dz-grid" />
            <div className="dz-cross tl" />
            <div className="dz-cross tr" />
            <div className="dz-cross bl" />
            <div className="dz-cross br" />
            <div className="dz-inner">
              <div className="dz-icon">
                <svg viewBox="0 0 64 80" width="56" height="70">
                  <rect x="2" y="2" width="50" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="10" y1="16" x2="44" y2="16" stroke="currentColor" strokeWidth="1" />
                  <line x1="10" y1="24" x2="40" y2="24" stroke="currentColor" strokeWidth="1" />
                  <line x1="10" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="1" />
                  <line x1="10" y1="40" x2="36" y2="40" stroke="currentColor" strokeWidth="1" />
                  <line x1="10" y1="48" x2="44" y2="48" stroke="currentColor" strokeWidth="1" />
                  <circle cx="48" cy="62" r="14" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
                  <text x="48" y="66" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="14" fill="currentColor">
                    LS
                  </text>
                </svg>
              </div>
              <p className="serif" style={{ fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>
                {stage === "dragging" ? <em>Release to upload</em> : "Drag a PDF here"}
              </p>
              <p className="mono-meta" style={{ marginTop: 6 }}>
                OR <span style={{ color: "var(--ink)", textDecoration: "underline" }}>browse files</span> · MAX 25MB · PDF ONLY
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="upload-opts">
            <div className="opt">
              <div className="mono">SOURCE LANGUAGE</div>
              <select className="select" defaultValue="auto">
                <option value="auto">Auto-detect</option>
                <option value="ko">Korean (한국어)</option>
                <option value="zh">Mandarin (中文)</option>
                <option value="ja">Japanese (日本語)</option>
              </select>
            </div>
            <div className="opt">
              <div className="mono">TRANSLATE TO</div>
              <select className="select" defaultValue="en">
                <option value="en">English</option>
              </select>
            </div>
            <div className="opt">
              <div className="mono">RISK ANALYSIS</div>
              <div className="row" style={{ padding: "8px 0" }}>
                <input type="checkbox" defaultChecked id="ra" style={{ accentColor: "var(--stamp)" }} />
                <label htmlFor="ra" style={{ cursor: "pointer" }}>
                  Detect high-risk clauses
                </label>
              </div>
            </div>
            <div className="opt">
              <div className="mono">GLOSSARY</div>
              <select className="select" defaultValue="lease">
                <option value="lease">Real-estate · KR lease</option>
                <option value="employment">Employment contract</option>
                <option value="nda">NDA / confidentiality</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          {error && <p style={{ color: "var(--stamp)", fontSize: 13, marginTop: 12 }}>{error}</p>}

          <div className="upload-foot">
            <p className="mono-meta">
              ! Files are processed in your workspace only — never shared, never trained on. Originals are stored
              encrypted in Supabase Storage with RLS.
            </p>
          </div>
        </>
      ) : (
        <ProcessingPipeline
          step={step}
          done={stage === "done"}
          error={stage === "error" ? error : null}
          fileName={fileName}
          clauses={counts.clauses}
          highRisk={counts.high}
          onOpen={() => docId && router.push(`/documents/${docId}`)}
          onReset={reset}
        />
      )}
    </section>
  );
}
