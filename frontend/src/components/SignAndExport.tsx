"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDownload, apiFetch, apiJson } from "@/lib/api";
import type { AuditEventDto, SignatureDto } from "@/lib/types";
import StampSeal from "./StampSeal";

function ledgerType(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("sign")) return "type-sign";
  if (t.includes("export")) return "type-export";
  return "";
}

export default function SignAndExport({
  documentId,
  fileName,
}: {
  documentId: string;
  fileName: string;
}) {
  const [signature, setSignature] = useState<SignatureDto | null>(null);
  const [audit, setAudit] = useState<AuditEventDto[]>([]);
  const [signerName, setSignerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState<"review" | "confirming">("review");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    try {
      setAudit(await apiJson<AuditEventDto[]>(`/api/documents/${documentId}/audit`));
    } catch {
      /* ignore */
    }
  }, [documentId]);

  useEffect(() => {
    apiJson<SignatureDto>(`/api/documents/${documentId}/signature`).then(setSignature).catch(() => {});
    loadAudit();
  }, [documentId, loadAudit]);

  const sign = useCallback(async () => {
    if (!signerName.trim() || !agreed) return;
    setError(null);
    setStep("confirming");
    setProgress(0);
    const iv = setInterval(() => setProgress((p) => Math.min(p + 7, 92)), 60);
    try {
      await apiFetch(`/api/documents/${documentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim() }),
      });
      setProgress(100);
      setSignature(await apiJson<SignatureDto>(`/api/documents/${documentId}/signature`));
      await loadAudit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
      setStep("review");
    } finally {
      clearInterval(iv);
    }
  }, [documentId, signerName, agreed, loadAudit]);

  const base = fileName.replace(/\.pdf$/i, "");
  const signed = !!signature;

  return (
    <section>
      <div className="section-eyebrow solo" style={{ marginBottom: 12 }}>
        <span>{signed ? "SEALED" : "STEP · SIGN & EXPORT"}</span>
        <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        <span>DOC · {documentId.slice(0, 8)}</span>
      </div>

      <div className="signing-grid">
        {/* LEFT: sign + export */}
        <div className="sign-col">
          {signed ? (
            <div className="sign-card signed" data-testid="signed-status">
              <div className="sign-card-head">
                <div className="mono">SIGNED · SEALED · STAMPED</div>
                <span className="badge-mono stamp">VERIFIED</span>
              </div>
              <div className="sign-doc-pre">
                <div className="party tenant" style={{ borderStyle: "solid" }}>
                  <div className="mono">LESSEE · SIGNER</div>
                  <div className="party-name serif">{signature!.signerName}</div>
                  <div className="party-sig final">
                    <span className="serif" style={{ fontStyle: "italic", fontSize: 26 }}>
                      {signature!.signerName}
                    </span>
                    <div className="stamp-final">
                      <StampSeal size={60} label="LS" sub="SIGNED · VERIFIED" />
                    </div>
                  </div>
                  <div className="mono-meta">SIGNED · {new Date(signature!.signedAt).toLocaleString()}</div>
                </div>
                <div className="sign-hash">
                  <div className="mono">SHA-256</div>
                  <code>{signature!.signedHash}</code>
                </div>
              </div>
              <div className="signed-actions">
                <button
                  className="cta stamp"
                  data-testid="download-signed"
                  onClick={() => apiDownload(`/api/documents/${documentId}/signed-pdf`, `${base}-signed.pdf`)}
                >
                  Download signed PDF <span className="arrow">↓</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="sign-card">
              <div className="sign-card-head">
                <div className="mono">SIGNATURE BLOCK</div>
                <span className="badge-mono">PDFSHARP · STAMP</span>
              </div>
              <div className="sign-doc-pre">
                <p className="mono-meta" style={{ marginBottom: 14 }}>
                  By signing below, I acknowledge that the original-language text prevails and that I have reviewed the
                  bilingual translation and any high-risk clauses.
                </p>
                <div className="party tenant">
                  <div className="mono">SIGNER</div>
                  <div className="party-name serif">{signerName || "Your name"}</div>
                  <div className={"party-sig sig-input " + (step === "confirming" ? "stamping" : "")}>
                    <input
                      data-testid="signer-name"
                      className="sig-typer"
                      type="text"
                      placeholder="Type your full name…"
                      value={signerName}
                      disabled={step === "confirming"}
                      onChange={(e) => setSignerName(e.target.value)}
                    />
                    {step === "confirming" && (
                      <div className="stamp-overlay">
                        <StampSeal size={70} label="SIGNED" sub="LINGUASIGN · VERIFIED" />
                      </div>
                    )}
                  </div>
                  <div className="mono-meta">{step === "confirming" ? "SEALING…" : "AWAITING SIGNATURE"}</div>
                </div>
              </div>
              <div className="sign-controls">
                <label className="agree">
                  <input
                    data-testid="agree-check"
                    type="checkbox"
                    checked={agreed}
                    disabled={step === "confirming"}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I confirm I reviewed the clauses including any high-risk items, and understand this is an electronic
                    signature — not a certified/qualified signature.
                  </span>
                </label>
                {error && <p style={{ color: "var(--stamp)", fontSize: 13, margin: 0 }}>{error}</p>}
                {step === "confirming" ? (
                  <div className="sign-progress">
                    <div className="mono-meta">HASHING · STAMPING · WRITING AUDIT EVENT…</div>
                    <div className="progress-bar">
                      <div style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    className="cta stamp sign-btn"
                    data-testid="sign-button"
                    disabled={!signerName.trim() || !agreed}
                    onClick={sign}
                  >
                    Sign &amp; seal document <span className="arrow">→</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="export-card">
            <div className="export-head">
              <div>
                <div className="mono">AUDIT PACKAGE · ZIP</div>
                <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>
                  Everything needed to defend this contract
                </div>
              </div>
              <span className="badge-mono">{signed ? "READY" : "PENDING"}</span>
            </div>
            <ul className="export-list">
              <li>
                signed.pdf <span className="mono-meta">{signed ? "stamped" : "—"}</span>
              </li>
              <li>
                original.pdf <span className="mono-meta">sha-256 verified</span>
              </li>
              <li>
                metadata.json <span className="mono-meta">document + signature</span>
              </li>
              <li>
                audit.json <span className="mono-meta">{audit.length} events</span>
              </li>
            </ul>
            <button
              className={"cta " + (signed ? "stamp" : "ghost")}
              data-testid="download-export"
              disabled={!signed}
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => apiDownload(`/api/documents/${documentId}/export`, `${base}-linguasign-export.zip`)}
            >
              {signed ? "Export package (.zip)" : "Sign first to enable export"}
            </button>
          </div>
        </div>

        {/* RIGHT: audit ledger */}
        <div className="audit-col">
          <div className="audit-head">
            <div>
              <div className="mono">AUDIT LEDGER</div>
              <div className="serif" style={{ fontSize: 20, marginTop: 4, letterSpacing: "-0.01em" }}>
                Append-only · hashed
              </div>
            </div>
            <span className="badge-mono solid">{audit.length} EVENTS</span>
          </div>

          <ol className="ledger">
            {audit.length === 0 && <li className="mono-meta" style={{ padding: "10px 0" }}>No events yet.</li>}
            {audit.map((e, i) => (
              <li
                key={e.id}
                data-testid="audit-event"
                className={"ledger-row " + (ledgerType(e.eventType) === "type-sign" ? "ledger-sign" : "")}
              >
                <div className="ledger-tick">
                  <span className="mono-meta">{String(i + 1).padStart(3, "0")}</span>
                </div>
                <div className="ledger-body">
                  <div className="ledger-line">
                    <span className={"ledger-type " + ledgerType(e.eventType)}>{e.eventType}</span>
                    <span className="mono-meta">{new Date(e.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {e.detail && <div className="ledger-detail">{e.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="mono-meta" style={{ marginTop: 16 }}>
        Simple electronic signature with audit trail · not a certified/qualified signature.
      </p>
    </section>
  );
}
