"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) setError(error.message);
    else if (mode === "signup") setMessage("Check your email to confirm your account.");
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="auth-screen">
      <div className="auth-wrap">
        {/* left mark column */}
        <aside className="auth-side">
          <div className="auth-mark">
            <div className="mark-circle">
              <span className="serif" style={{ fontStyle: "italic", fontSize: 56 }}>
                L
              </span>
              <div className="mark-ring" />
            </div>
          </div>
          <div className="auth-side-meta">
            <div className="mono">SECURE · SUPABASE JWT · RLS</div>
            <p
              className="serif"
              style={{ fontSize: 26, lineHeight: 1.2, margin: "16px 0 0", letterSpacing: "-0.01em" }}
            >
              &ldquo;I read every line, in my own language, before I signed.&rdquo;
            </p>
            <div className="mono" style={{ marginTop: 18 }}>
              — J. KANG, GANGNAM
            </div>
          </div>
          <div className="auth-side-footer">
            <div className="mono">SESSION · {today}</div>
            <div className="mono">SEOUL · UTC+9</div>
          </div>
        </aside>

        {/* form column */}
        <section className="auth-form-wrap">
          <div className="section-eyebrow solo">
            <span>{mode === "signin" ? "RETURN" : "ENROL"}</span>
            <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
            <span>0{mode === "signin" ? 1 : 2} / 02</span>
          </div>

          <h1 className="auth-title">
            {mode === "signin" ? (
              <>
                Welcome <em>back</em>.
              </>
            ) : (
              <>
                Create an <em>account</em>.
              </>
            )}
          </h1>
          <p className="auth-sub">
            {mode === "signin"
              ? "Sign in to review and sign your bilingual documents."
              : "Start a workspace — your documents stay private to you."}
          </p>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="field">
              <span className="mono">EMAIL</span>
              <input
                data-testid="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="mono row between" style={{ width: "100%" }}>
                <span>PASSWORD</span>
                <span className="mono" style={{ color: "var(--ink-3)" }}>
                  6+ CHARS
                </span>
              </span>
              <input
                data-testid="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && <p style={{ color: "var(--stamp)", fontSize: 13, margin: 0 }}>{error}</p>}
            {message && (
              <p style={{ color: "var(--ink-2)", fontSize: 13, margin: 0 }}>{message}</p>
            )}

            <button
              data-testid="auth-submit"
              className="cta stamp"
              type="submit"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "14px 20px" }}
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}{" "}
              <span className="arrow">→</span>
            </button>
          </form>

          <p className="auth-toggle mono">
            {mode === "signin" ? (
              <>
                NO ACCOUNT?{" "}
                <a data-testid="auth-toggle" onClick={() => setMode("signup")}>
                  CREATE ONE →
                </a>
              </>
            ) : (
              <>
                ALREADY A USER?{" "}
                <a data-testid="auth-toggle" onClick={() => setMode("signin")}>
                  SIGN IN →
                </a>
              </>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
