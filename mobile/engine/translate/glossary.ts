/**
 * Legal-term glossary — direct TypeScript port of ml/translation-sidecar/glossary.py.
 * Keep the two files in sync; the Python module is the source of truth for terms.
 *
 * Two mechanisms:
 *  1. getTargetPrefix — when a known Korean term OPENS the block, return the canonical
 *     English phrase; the decoder is seeded with its tokens (constrained decoding).
 *  2. postProcess — after translation, substitute known mistranslations of terms that
 *     appear mid-sentence in the source.
 */

export const GLOSSARY_KO_EN: Record<string, string> = {
  준거법: "governing law",
  중재: "arbitration",
  면책: "indemnification",
  기밀유지: "confidentiality",
  불가항력: "force majeure",
  해지: "termination",
  해지권: "right of termination",
  취소: "cancellation",
  취소권: "right of cancellation",
  보증금: "security deposit",
  위약금: "penalty",
  자동갱신: "automatic renewal",
  환불: "refund",
  책임: "liability",
  이용정지: "suspension",
  갑: "Party A",
  을: "Party B",
  임차인: "tenant",
  임대인: "landlord",
  근로계약: "employment contract",
  손해배상: "damages",
  지식재산권: "intellectual property rights",
};

const GLOSSARIES: Record<string, Record<string, string>> = {
  "ko-en": GLOSSARY_KO_EN,
};

/** [badTranslation, canonical] — applied case-insensitively, gated on source term. */
const SUBSTITUTIONS: Record<string, [string, string][]> = {
  "ko-en": [
    ["applicable law", "governing law"],
    ["governing act", "governing law"],
    ["jun law", "governing law"],
    ["jun-law", "governing law"],
    ["zingang", "governing law"],
    ["intercession", "arbitration"],
    ["inter media", "arbitration"],
    ["intermediate", "arbitration"],
    ["intercede", "arbitration"],
    ["mediation", "arbitration"],
    ["arbitral", "arbitration"],
    ["exemption from liability", "indemnification"],
    ["liability exemption", "indemnification"],
    ["exemption", "indemnification"],
    ["immunity", "indemnification"],
    ["disclaimer", "indemnification"],
    ["irresistible force", "force majeure"],
    ["unavoidable force", "force majeure"],
    ["acts of god", "force majeure"],
    ["act of god", "force majeure"],
    ["force of nature", "force majeure"],
    ["unforeseeable circumstances", "force majeure"],
    ["security maintenance", "confidentiality"],
    ["confidentiality maintenance", "confidentiality"],
    ["secrecy maintenance", "confidentiality"],
    ["secret maintenance", "confidentiality"],
    ["maintaining confidentiality", "confidentiality"],
    ["first party", "Party A"],
    ["class a", "Party A"],
    ["Pack", "Party A"],
    ["armor", "Party A"],
    ["second party", "Party B"],
    ["subordinate", "Party B"],
    ["worker", "Party B"],
    ["cancellation", "termination"],
    ["rescission", "termination"],
    ["right to terminate", "right of termination"],
    ["right to cancel", "right of termination"],
    ["right of cancellation", "right of termination"],
    ["termination right", "right of termination"],
    ["deposit money", "security deposit"],
    ["guarantee money", "security deposit"],
    ["guarantee deposit", "security deposit"],
    ["bail", "security deposit"],
    ["abolition", "cancellation"],
    ["withdrawal", "cancellation"],
    ["revocation", "cancellation"],
    ["annulment", "cancellation"],
    ["right of revocation", "right of cancellation"],
    ["right to revoke", "right of cancellation"],
    ["right of withdrawal", "right of cancellation"],
    ["reimbursement", "refund"],
    ["return payment", "refund"],
    ["repayment", "refund"],
    ["responsibility", "liability"],
    ["use suspension", "suspension"],
    ["usage stop", "suspension"],
    ["usage ban", "suspension"],
    ["service ban", "suspension"],
    ["counterfeit payment", "penalty"],
    ["counterfeit", "penalty"],
    ["breach money", "penalty"],
    ["default money", "penalty"],
    ["penalty clause", "penalty"],
    ["liquidated damages", "penalty"],
    ["dividends", "penalty"],
    ["divides", "penalty"],
    ["premium", "penalty"],
    ["auto renewal", "automatic renewal"],
    ["auto-renewal", "automatic renewal"],
    ["automatically updated", "automatically renewed"],
    ["auto-extend", "automatic renewal"],
    ["lessee", "tenant"],
    ["occupant", "tenant"],
    ["the donor", "tenant"],
    ["donor", "tenant"],
    ["lessor", "landlord"],
    ["leaser", "landlord"],
    ["rental provider", "landlord"],
    ["labor contract", "employment contract"],
    ["work contract", "employment contract"],
    ["labour contract", "employment contract"],
    ["damage compensation", "damages"],
    ["injury compensation", "damages"],
    ["compensation for damages", "damages"],
    ["intellectual property right", "intellectual property rights"],
  ],
};

/** English phrase to force at the start of decoding, or null if no constraint. */
export function getTargetPrefix(
  sourceText: string,
  srcLang: string,
  tgtLang: string,
): string | null {
  const glossary = GLOSSARIES[`${srcLang}-${tgtLang}`];
  if (!glossary) return null;
  const stripped = sourceText.trim();
  for (const [term, phrase] of Object.entries(glossary)) {
    if (stripped.startsWith(term)) return phrase;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Post-translation substitution for mid-sentence terms (port of glossary.post_process). */
export function postProcess(
  sourceText: string,
  translatedText: string,
  srcLang: string,
  tgtLang: string,
): string {
  const pair = `${srcLang}-${tgtLang}`;
  const glossary = GLOSSARIES[pair];
  const substitutions = SUBSTITUTIONS[pair];
  if (!glossary || !substitutions) return translatedText;

  let result = translatedText;
  for (const [term, canonical] of Object.entries(glossary)) {
    if (!sourceText.includes(term)) continue;
    if (result.toLowerCase().includes(canonical.toLowerCase())) continue;
    for (const [bad, good] of substitutions) {
      if (result.toLowerCase().includes(bad.toLowerCase())) {
        result = result.replace(new RegExp(escapeRegExp(bad), "gi"), good);
        break; // at most one substitution per Korean term
      }
    }
  }
  return result;
}
