/**
 * Plain-language explanations per clause type — the mobile replacement for the
 * server LLM's one-sentence explanation. Curated, deterministic, no hallucination.
 * Keys must stay in sync with the classifier taxonomy (labels.json).
 */

export const EXPLANATIONS: Record<string, string> = {
  AUTO_RENEWAL:
    "This contract renews by itself unless you actively cancel it before the deadline — missing the window locks you in for another term.",
  PENALTY:
    "You can be charged an extra fee or lose money if you break or leave this agreement — check the exact amount before signing.",
  NON_COMPETE:
    "This restricts where you can work or do business after this contract ends — it can limit your future income.",
  LIABILITY:
    "This limits what the other party owes you if things go wrong, or makes you responsible for losses — you may have little recourse.",
  ARBITRATION:
    "Disputes go to a private arbitrator instead of court — you give up the right to sue or join a class action.",
  TERMINATION:
    "This sets when and how the contract can be ended — note who can end it, with how much notice, and what you owe if it happens.",
  DEPOSIT:
    "Money you hand over up front — check exactly when and how you get it back, and what can be deducted.",
  CONFIDENTIALITY:
    "You must keep certain information secret — breaking this can carry penalties even after the contract ends.",
  GOVERNING_LAW:
    "This picks which country's or region's law applies and where disputes are handled — it may be far from where you live.",
  PAYMENT:
    "This sets what, when, and how you must pay — check amounts, due dates, and what happens if you pay late.",
  IP: "This decides who owns creative or intellectual work — you may be giving up rights to things you make.",
  NONE: "No specific risk detected in this clause.",
};

export function explain(type: string): string {
  return EXPLANATIONS[type] ?? EXPLANATIONS.NONE;
}
