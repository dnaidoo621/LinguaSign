"""
Generate labeled training data for the mobile risk classifier.

Reads Korean-English clause pairs from the translation training corpus and labels each
pair with (risk_level, clause_type) using the same LLM + deterministic-rules merge the
server uses (OllamaClauseAnalyzer + RiskRules). Emits TWO rows per pair — the Korean
source and the English reference share one label, so a single multilingual classifier
learns both sides.

Output: data/risk_labeled.tsv   columns: text \t lang \t risk \t type
Progress: data/label_progress.json  (batch index — safe to resume with --resume)

Usage:
    python label_data.py [--resume] [--limit N] [--model qwen2.5:7b]
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import re
import sys
import time
import urllib.request

DATA_DIR = pathlib.Path(__file__).parent / "data"
TRANSLATION_DATA = pathlib.Path(__file__).parent.parent / "translation-sidecar" / "data"
OUT_PATH = DATA_DIR / "risk_labeled.tsv"
PROGRESS_PATH = DATA_DIR / "label_progress.json"

OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
BATCH_SIZE = 8

# Closed taxonomy — must stay in sync with the mobile explanation templates.
RISK_LEVELS = {"none", "low", "medium", "high"}
CLAUSE_TYPES = {
    "AUTO_RENEWAL", "PENALTY", "NON_COMPETE", "LIABILITY", "ARBITRATION",
    "TERMINATION", "DEPOSIT", "CONFIDENTIALITY", "GOVERNING_LAW",
    "PAYMENT", "IP", "NONE",
}

_SEVERITY = {"none": 0, "low": 1, "medium": 2, "high": 3}

# Port of backend RiskRules.cs — first match wins; runs on the ENGLISH side.
_RULES: list[tuple[str, str, list[str]]] = [
    ("AUTO_RENEWAL", "high", ["automatically renew", "auto-renew", "automatic renewal", "renews automatically"]),
    ("PENALTY", "high", ["penalty", "liquidated damages", "late fee", "forfeit"]),
    ("NON_COMPETE", "high", ["non-compete", "non compete", "noncompete", "restraint of trade"]),
    ("LIABILITY", "high", ["limitation of liability", "not be liable", "hold harmless", "indemnif", "waive", "waiver"]),
    ("ARBITRATION", "medium", ["arbitration", "arbitrate"]),
    ("TERMINATION", "medium", ["terminate", "termination"]),
    ("DEPOSIT", "medium", ["security deposit", "deposit"]),
    ("CONFIDENTIALITY", "low", ["confidential", "non-disclosure", "nondisclosure"]),
    ("GOVERNING_LAW", "low", ["governing law", "jurisdiction"]),
]


def rules_detect(en_text: str) -> tuple[str, str]:
    lower = en_text.lower()
    for ctype, level, keywords in _RULES:
        if any(k in lower for k in keywords):
            return level, ctype
    return "none", "NONE"


def load_pairs() -> list[tuple[str, str]]:
    """Load and dedupe (ko, en) pairs from the translation training corpus."""
    seen: set[str] = set()
    pairs: list[tuple[str, str]] = []
    for name in ("legal_train.tsv", "legal_pairs.tsv", "legal_pairs_extra.tsv"):
        p = TRANSLATION_DATA / name
        if not p.exists():
            continue
        with open(p, encoding="utf-8") as f:
            for row in csv.reader(f, delimiter="\t"):
                if len(row) != 2:
                    continue
                ko, en = row[0].strip(), row[1].strip()
                if not ko or not en or ko in seen:
                    continue
                seen.add(ko)
                pairs.append((ko, en))
    return pairs


def ollama_chat(model: str, system: str, user: str, retries: int = 3) -> str:
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "stream": False,
    }).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.load(resp)
            return data["choices"][0]["message"]["content"]
        except Exception as e:  # noqa: BLE001 — retry any transport/parse error
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1} after error: {e}", flush=True)
            time.sleep(5 * (attempt + 1))
    return "{}"


_SYSTEM = (
    "You are a contract risk analyst labeling training data. For each clause (Korean "
    "original with its English translation), assess the risk TO THE SIGNER and pick a type.\n"
    "risk must be one of: none, low, medium, high.\n"
    "type must be EXACTLY one of: AUTO_RENEWAL, PENALTY, NON_COMPETE, LIABILITY, ARBITRATION, "
    "TERMINATION, DEPOSIT, CONFIDENTIALITY, GOVERNING_LAW, PAYMENT, IP, NONE.\n"
    "Definitions/notices/boilerplate with no obligation are risk none, type NONE. Be accurate."
)


def label_batch(model: str, batch: list[tuple[str, str]]) -> list[tuple[str, str] | None]:
    """Return [(risk, type) or None per pair] — None means unparseable, skip."""
    items = [
        {"id": i + 1, "korean": ko, "english": en}
        for i, (ko, en) in enumerate(batch)
    ]
    user = (
        "Label each clause. Respond ONLY with JSON of the form "
        '{"labels":[{"id":<id>,"risk":"<none|low|medium|high>","type":"<TYPE>"}]}\n\n'
        + json.dumps(items, ensure_ascii=False)
    )
    content = ollama_chat(model, _SYSTEM, user)
    out: list[tuple[str, str] | None] = [None] * len(batch)
    try:
        doc = json.loads(content)
        for el in doc.get("labels", []):
            idx = int(el.get("id", 0)) - 1
            risk = str(el.get("risk", "")).strip().lower()
            ctype = re.sub(r"[^A-Z_]", "", str(el.get("type", "")).strip().upper())
            if 0 <= idx < len(batch) and risk in RISK_LEVELS and ctype in CLAUSE_TYPES:
                out[idx] = (risk, ctype)
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return out


def merge_with_rules(en_text: str, llm: tuple[str, str]) -> tuple[str, str]:
    """Same merge as the server: rules guard against LLM false negatives (max severity wins)."""
    llm_risk, llm_type = llm
    rule_risk, rule_type = rules_detect(en_text)
    if _SEVERITY[rule_risk] > _SEVERITY[llm_risk]:
        return rule_risk, rule_type
    return llm_risk, llm_type


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen2.5:7b")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="label at most N pairs (0 = all)")
    args = ap.parse_args()

    DATA_DIR.mkdir(exist_ok=True)
    pairs = load_pairs()
    if args.limit:
        pairs = pairs[: args.limit]
    total_batches = (len(pairs) + BATCH_SIZE - 1) // BATCH_SIZE

    start_batch = 0
    if args.resume and PROGRESS_PATH.exists():
        start_batch = json.loads(PROGRESS_PATH.read_text()).get("next_batch", 0)
        print(f"Resuming from batch {start_batch}/{total_batches}")
    elif OUT_PATH.exists() and not args.resume:
        OUT_PATH.unlink()  # fresh run

    labeled = skipped = 0
    for b in range(start_batch, total_batches):
        batch = pairs[b * BATCH_SIZE : (b + 1) * BATCH_SIZE]
        t0 = time.time()
        results = label_batch(args.model, batch)

        rows: list[list[str]] = []
        for (ko, en), res in zip(batch, results):
            if res is None:
                skipped += 1
                continue
            risk, ctype = merge_with_rules(en, res)
            rows.append([ko, "ko", risk, ctype])
            rows.append([en, "en", risk, ctype])
            labeled += 1

        # Incremental append + progress checkpoint (resumable).
        with open(OUT_PATH, "a", encoding="utf-8", newline="") as f:
            csv.writer(f, delimiter="\t").writerows(rows)
        PROGRESS_PATH.write_text(json.dumps({"next_batch": b + 1, "total": total_batches}))

        print(
            f"batch {b + 1}/{total_batches}  +{len(rows)} rows  "
            f"({labeled} pairs labeled, {skipped} skipped)  {time.time() - t0:.1f}s",
            flush=True,
        )

    print(f"Done: {labeled} pairs labeled → {OUT_PATH} ({skipped} skipped)")


if __name__ == "__main__":
    sys.exit(main())
