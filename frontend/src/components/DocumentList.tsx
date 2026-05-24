"use client";

import Link from "next/link";
import type { DocumentSummary } from "@/lib/types";
import { relTime } from "@/lib/format";
import LangChip from "./LangChip";
import StatusChip from "./StatusChip";

export function DocumentList({ docs }: { docs: DocumentSummary[] }) {
  if (docs.length === 0) {
    return (
      <section className="doc-list">
        <div style={{ padding: 48, textAlign: "center", color: "var(--ink-3)" }}>
          <p className="serif" style={{ fontSize: 22 }}>No documents match.</p>
          <p className="mono-meta" style={{ marginTop: 8 }}>Upload a contract to get started.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="doc-list">
      <div className="doc-row doc-head static">
        <div>NO.</div>
        <div>DOCUMENT</div>
        <div>LANG</div>
        <div>PAGES</div>
        <div>UPLOADED</div>
        <div>RISK</div>
        <div>STATUS</div>
        <div></div>
      </div>
      {docs.map((d, i) => (
        <DocRow key={d.id} d={d} idx={i + 1} />
      ))}
    </section>
  );
}

function DocRow({ d, idx }: { d: DocumentSummary; idx: number }) {
  const extracted = d.status === "Extracted";
  const inner = (
    <>
      <div className="mono-meta">{String(idx).padStart(2, "0")}</div>
      <div className="doc-name">
        <div className="doc-name-title">{d.fileName}</div>
        <div className="doc-name-src">#{d.id.slice(0, 8)}</div>
      </div>
      <div>
        {d.sourceLanguage ? (
          <LangChip from={d.sourceLanguage} to="en" />
        ) : (
          <span className="mono-meta">—</span>
        )}
      </div>
      <div className="mono-meta">{d.pageCount > 0 ? `${d.pageCount} pp` : "—"}</div>
      <div className="mono-meta">{relTime(d.createdAt)}</div>
      <div className="risk-mini">
        <span className="mono-meta">—</span>
      </div>
      <div>
        <StatusChip status={d.status} />
      </div>
      <div className="doc-action mono">{extracted ? "OPEN →" : ""}</div>
    </>
  );

  return extracted ? (
    <Link href={`/documents/${d.id}`} className="doc-row">
      {inner}
    </Link>
  ) : (
    <div className="doc-row static">{inner}</div>
  );
}
