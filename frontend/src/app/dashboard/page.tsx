"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { apiJson } from "@/lib/api";
import { pad2, relTime } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { AuthForm } from "@/components/AuthForm";
import { UploadDropzone } from "@/components/UploadDropzone";
import { DocumentList } from "@/components/DocumentList";

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["ready", "Ready"],
  ["processing", "Processing"],
  ["failed", "Failed"],
];

export default function DashboardPage() {
  const { user, loading } = useUser();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await apiJson<DocumentSummary[]>("/api/documents"));
    } catch {
      /* ignore transient */
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Poll while any document is still processing.
  useEffect(() => {
    if (!user) return;
    const pending = docs.some((d) => d.status === "Uploaded" || d.status === "Processing");
    if (pending && !timer.current) {
      timer.current = setInterval(() => void load(), 3000);
    } else if (!pending && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [docs, load, user]);

  if (loading) return <main className="screen mono-meta">Loading…</main>;
  if (!user) return <AuthForm />;

  const total = docs.length;
  const ready = docs.filter((d) => d.status === "Extracted").length;
  const processing = docs.filter((d) => d.status === "Uploaded" || d.status === "Processing").length;
  const last = docs.length ? relTime(docs[0].createdAt) : "—";

  const filtered = docs.filter((d) => {
    if (filter === "ready" && d.status !== "Extracted") return false;
    if (filter === "processing" && !(d.status === "Uploaded" || d.status === "Processing")) return false;
    if (filter === "failed" && d.status !== "Failed") return false;
    if (q && !d.fileName.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="dash">
      <div className="wrap">
        <header className="dash-head">
          <div>
            <div className="section-eyebrow solo">
              <span>WORKSPACE / {user.email}</span>
              <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
              <span>{new Date().toLocaleDateString("en-CA")}</span>
            </div>
            <h1 className="dash-title">
              Your <em>documents</em>.
            </h1>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <button
              className="cta ghost"
              style={{ fontSize: 12, padding: "8px 14px" }}
              onClick={() => void createClient().auth.signOut()}
            >
              Sign out
            </button>
            <button className="cta stamp" data-testid="new-document" onClick={() => setShowUpload((v) => !v)}>
              New document <span className="arrow">+</span>
            </button>
          </div>
        </header>

        <section className="stat-ledger">
          <div className="stat">
            <div className="mono">TOTAL</div>
            <div className="stat-num">{pad2(total)}</div>
            <div className="stat-bar"><div style={{ width: "100%" }} /></div>
          </div>
          <div className="stat">
            <div className="mono">READY</div>
            <div className="stat-num">{pad2(ready)}</div>
            <div className="stat-bar"><div style={{ width: `${total ? (ready / total) * 100 : 0}%` }} /></div>
          </div>
          <div className="stat">
            <div className="mono">PROCESSING</div>
            <div className="stat-num" style={{ color: processing ? "var(--stamp)" : undefined }}>
              {pad2(processing)}
            </div>
            <div className="stat-bar">
              <div style={{ width: `${total ? (processing / total) * 100 : 0}%`, background: processing ? "var(--stamp)" : undefined }} />
            </div>
          </div>
          <div className="stat">
            <div className="mono">LAST UPLOAD</div>
            <div className="stat-num small">{last}</div>
            <div className="stat-bar"><div style={{ width: "20%" }} /></div>
          </div>
        </section>

        {showUpload && (
          <div style={{ marginBottom: 28 }}>
            <UploadDropzone
              onUploaded={() => {
                setShowUpload(false);
                void load();
              }}
            />
          </div>
        )}

        <section className="dash-filter">
          <div className="filter-tabs">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                className={"tab " + (filter === id ? "active" : "")}
                onClick={() => setFilter(id)}
              >
                {label}
                {id === "all" && <span className="tab-count">{total}</span>}
              </button>
            ))}
          </div>
          <input
            className="search"
            placeholder="Search filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </section>

        <DocumentList docs={filtered} />
      </div>
    </main>
  );
}
