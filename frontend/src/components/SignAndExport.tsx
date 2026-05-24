"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDownload, apiFetch, apiJson } from "@/lib/api";
import type { AuditEventDto, SignatureDto } from "@/lib/types";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    try {
      setAudit(await apiJson<AuditEventDto[]>(`/api/documents/${documentId}/audit`));
    } catch {
      /* ignore */
    }
  }, [documentId]);

  useEffect(() => {
    apiJson<SignatureDto>(`/api/documents/${documentId}/signature`)
      .then(setSignature)
      .catch(() => {});
    loadAudit();
  }, [documentId, loadAudit]);

  const sign = useCallback(async () => {
    if (!signerName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/documents/${documentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim() }),
      });
      setSignature(await apiJson<SignatureDto>(`/api/documents/${documentId}/signature`));
      await loadAudit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign.");
    } finally {
      setBusy(false);
    }
  }, [documentId, signerName, loadAudit]);

  const base = fileName.replace(/\.pdf$/i, "");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold">Sign &amp; export</h2>

      {signature ? (
        <div data-testid="signed-status" className="text-sm text-gray-700">
          ✅ Signed by <strong>{signature.signerName}</strong> on{" "}
          {new Date(signature.signedAt).toLocaleString()}.
          <p className="mt-1 break-all font-mono text-xs text-gray-400">
            hash: {signature.signedHash.slice(0, 32)}…
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            data-testid="signer-name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Type your full name to sign"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            data-testid="sign-button"
            onClick={sign}
            disabled={busy || !signerName.trim()}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Signing…" : "Sign document"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {signature && (
          <button
            data-testid="download-signed"
            onClick={() => apiDownload(`/api/documents/${documentId}/signed-pdf`, `${base}-signed.pdf`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Download signed PDF
          </button>
        )}
        <button
          data-testid="download-export"
          onClick={() => apiDownload(`/api/documents/${documentId}/export`, `${base}-linguasign-export.zip`)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Export audit package (ZIP)
        </button>
      </div>

      {audit.length > 0 && (
        <div className="mt-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Audit trail</p>
          <ul className="mt-1 flex flex-col gap-1">
            {audit.map((e) => (
              <li key={e.id} data-testid="audit-event" className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{e.eventType}</span> ·{" "}
                {new Date(e.createdAt).toLocaleString()}
                {e.detail ? ` · ${e.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Simple electronic signature with audit trail. Not a certified/qualified signature.
      </p>
    </section>
  );
}
