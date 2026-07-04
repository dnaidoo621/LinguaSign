/**
 * Deterministic keyword risk rules — direct port of backend RiskRules.cs.
 * Runs on the ENGLISH clause text; merged with the classifier by max severity
 * (rules guard against classifier false negatives).
 */

export type RiskLevel = "none" | "low" | "medium" | "high";

export const SEVERITY: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };

interface Rule {
  type: string;
  level: RiskLevel;
  keywords: string[];
}

// Ordered by priority — first match wins (must mirror RiskRules.cs).
const RULES: Rule[] = [
  { type: "AUTO_RENEWAL", level: "high", keywords: ["automatically renew", "auto-renew", "automatic renewal", "renews automatically"] },
  { type: "PENALTY", level: "high", keywords: ["penalty", "liquidated damages", "late fee", "forfeit"] },
  { type: "NON_COMPETE", level: "high", keywords: ["non-compete", "non compete", "noncompete", "restraint of trade"] },
  { type: "LIABILITY", level: "high", keywords: ["limitation of liability", "not be liable", "hold harmless", "indemnif", "waive", "waiver"] },
  { type: "ARBITRATION", level: "medium", keywords: ["arbitration", "arbitrate"] },
  { type: "TERMINATION", level: "medium", keywords: ["terminate", "termination"] },
  { type: "DEPOSIT", level: "medium", keywords: ["security deposit", "deposit"] },
  { type: "CONFIDENTIALITY", level: "low", keywords: ["confidential", "non-disclosure", "nondisclosure"] },
  { type: "GOVERNING_LAW", level: "low", keywords: ["governing law", "jurisdiction"] },
];

export function rulesDetect(text: string | null | undefined): { level: RiskLevel; type: string } {
  if (!text || !text.trim()) return { level: "none", type: "NONE" };
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return { level: rule.level, type: rule.type };
    }
  }
  return { level: "none", type: "NONE" };
}
