"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SAMPLES = [
  {
    ko: "본 계약은 갱신 30일 전까지 통보 없이 자동 연장된다.",
    en: "This contract automatically renews without notice up to 30 days before expiration.",
  },
  {
    ko: "분쟁 발생 시 대한상사중재원의 중재에 따른다.",
    en: "Disputes shall be settled by arbitration at the Korean Commercial Arbitration Board.",
  },
  {
    ko: "임차인의 사유로 해지 시 2개월분 위약금이 부과된다.",
    en: "Early termination by the Lessee incurs a penalty of two months' rent.",
  },
];

export default function Landing() {
  const samples = useMemo(() => SAMPLES, []);
  const [i, setI] = useState(0);
  const [showEn, setShowEn] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setShowEn((s) => !s), 2400);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!showEn) setI((v) => (v + 1) % samples.length);
  }, [showEn, samples.length]);

  const s = samples[i];

  return (
    <main className="landing">
      {/* HERO */}
      <section className="hero" style={{ fontFamily: "-apple-system" }}>
        <div className="hero-grid">
          {/* mono ledger column */}
          <aside className="hero-ledger">
            <div className="ledger-row">
              <span className="bracket">001</span>
              <span className="mono-meta">UPLOAD A DOC IN ANY LANGUAGE</span>
            </div>
            <div className="ledger-row">
              <span className="bracket">002</span>
              <span className="mono-meta">SEE A CLAUSE-LINKED TRANSLATION</span>
            </div>
            <div className="ledger-row">
              <span className="bracket">003</span>
              <span className="mono-meta">INSPECT EVERY RISK</span>
            </div>
            <div className="ledger-row">
              <span className="bracket">004</span>
              <span className="mono-meta">SIGN WITH A FULL AUDIT TRAIL</span>
            </div>
            <hr className="hr" style={{ margin: "18px 0" }} />
            <div className="ledger-row" style={{ alignItems: "flex-start" }}>
              <span className="bracket">DOC</span>
              <div>
                <div className="mono-meta" style={{ color: "var(--ink)" }}>
                  Korean apartment lease
                </div>
                <div className="mono-meta">전세 임대차계약서 · 4 pp · 142 blocks</div>
              </div>
            </div>
          </aside>

          {/* main hero text */}
          <div className="hero-main">
            <div className="section-eyebrow solo">
              <span>LINGUASIGN · 2026</span>
              <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
              <span>EST. SEOUL · CAPE TOWN</span>
            </div>

            <h1 className="hero-title">
              Understand <em>every</em>
              <br />
              clause
              <span className="dot" />
              before you sign.
            </h1>

            <p className="hero-sub">
              LinguaSign turns foreign-language contracts into something you can{" "}
              <em>read, understand, and sign with confidence</em> — while preserving the original
              wording and a verifiable trail of every translation, risk, and signature.
            </p>

            <div className="hero-cta">
              <Link className="cta stamp" href="/dashboard">
                Upload a document <span className="arrow">→</span>
              </Link>
              <Link className="cta ghost" href="/dashboard">
                See your documents
              </Link>
            </div>

            {/* live morph clause */}
            <div className="morph">
              <div className="morph-label">
                <span className="bracket">LIVE</span>
                <span className="mono">ko → en · clause §5.2</span>
              </div>
              <div className="morph-text">
                <div className={"morph-stage " + (showEn ? "en" : "ko")}>
                  <div className="morph-ko" lang="ko">
                    {s.ko}
                  </div>
                  <div className="morph-en">{s.en}</div>
                </div>
                <div className="morph-bar" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PROOF POINTS */}
      <section className="proof wrap">
        <div className="proof-card">
          <div className="proof-num">01</div>
          <h3 className="proof-h">Clause-linked translation</h3>
          <p className="proof-p">
            Hover any sentence on either side. The matched original lights up. Nothing is
            paraphrased — it&apos;s traceable.
          </p>
        </div>
        <div className="proof-card">
          <div className="proof-num">02</div>
          <h3 className="proof-h">Plain-language risk</h3>
          <p className="proof-p">
            Auto-renewal, arbitration, penalty, non-compete. We flag the clauses that bite — and
            explain why in one sentence.
          </p>
        </div>
        <div className="proof-card">
          <div className="proof-num">03</div>
          <h3 className="proof-h">Signed with a paper trail</h3>
          <p className="proof-p">
            Every action — upload, translate, sign — is hashed and timestamped. Export the audit
            package as a sealed ZIP.
          </p>
        </div>
      </section>

      {/* DISCLAIMER STRIP */}
      <section className="strip">
        <div className="wrap row between">
          <span className="mono">! NOT CERTIFIED LEGAL TRANSLATION · NOT LEGAL ADVICE</span>
          <span className="mono">ALWAYS CONSULT A QUALIFIED PROFESSIONAL FOR LEGAL MATTERS</span>
        </div>
      </section>
    </main>
  );
}
