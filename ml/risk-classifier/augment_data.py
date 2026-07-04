"""
Targeted synthetic augmentation for underrepresented clause types.

The LLM-labeled corpus (risk_labeled.tsv) is dominated by NONE/TERMINATION rows;
rare types (PENALTY, NON_COMPETE, DEPOSIT, AUTO_RENEWAL, IP, CONFIDENTIALITY...)
have too few examples for the classifier to learn. This script generates diverse
Korean contract clauses PER TYPE with English translations via Ollama — the label
is assigned by construction (the generation topic IS the type), so no labeling
noise.

Output: data/risk_synthetic.tsv  (same format: text \t lang \t risk \t type)
Usage:  python augment_data.py [--per-type 60] [--model qwen2.5:7b]
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import time
import urllib.request

DATA_DIR = pathlib.Path(__file__).parent / "data"
OUT_PATH = DATA_DIR / "risk_synthetic.tsv"
OLLAMA_URL = "http://localhost:11434/v1/chat/completions"

# type → (risk level by construction, generation brief)
# Risk levels follow backend RiskRules.cs severities.
TARGETS: dict[str, tuple[str, str]] = {
    "PENALTY": ("high", "위약금, 지연손해금, 벌금, 몰수 조항 (penalty / liquidated damages / late fees / forfeiture)"),
    "NON_COMPETE": ("high", "경업금지, 겸업금지, 동종업계 취업 제한 조항 (non-compete / restraint of trade)"),
    "AUTO_RENEWAL": ("high", "자동갱신, 자동연장 조항 (automatic renewal / auto-extension)"),
    "LIABILITY": ("high", "책임 제한, 면책, 손해배상 포기 조항 (limitation of liability / indemnification / waiver)"),
    "DEPOSIT": ("medium", "보증금, 계약금, 전세금 조항 (security deposit / down payment)"),
    "ARBITRATION": ("medium", "중재, 분쟁해결 조항 (arbitration / dispute resolution)"),
    "TERMINATION": ("medium", "해지, 해제, 계약 종료 조항 (termination / rescission)"),
    "IP": ("medium", "지식재산권, 저작권, 특허 귀속 조항 (intellectual property ownership / assignment)"),
    "CONFIDENTIALITY": ("low", "기밀유지, 비밀유지 조항 (confidentiality / non-disclosure)"),
    "GOVERNING_LAW": ("low", "준거법, 관할법원 조항 (governing law / jurisdiction)"),
    "PAYMENT": ("low", "대금 지급, 급여, 임대료 지급 조항 (payment terms / salary / rent)"),
}


def ollama_json(model: str, system: str, user: str, retries: int = 3) -> dict:
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.9,  # diversity matters more than precision here
        "response_format": {"type": "json_object"},
        "stream": False,
    }).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = json.load(resp)
            return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1}: {e}", flush=True)
            time.sleep(5 * (attempt + 1))
    return {}


_SYSTEM = (
    "You write realistic Korean contract clauses for legal NLP training data. "
    "Vary the contract context (lease, employment, services, SaaS terms, sales, franchise), "
    "sentence structure, formality, and vocabulary. Each clause must be 1-2 sentences of "
    "natural legal Korean, with a faithful English translation."
)


def generate(model: str, ctype: str, brief: str, count: int, batch: int = 10) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    rounds = 0
    while len(pairs) < count and rounds < count:  # bounded retries
        rounds += 1
        doc = ollama_json(
            model, _SYSTEM,
            f"Generate {batch} DIFFERENT Korean contract clauses of this type: {brief}.\n"
            'Respond ONLY with JSON: {"clauses":[{"ko":"...","en":"..."}]}',
        )
        clauses = doc.get("clauses", [])
        if not isinstance(clauses, list):
            continue
        for el in clauses:
            # Ollama JSON mode sometimes emits an array of strings instead of
            # objects (same quirk handled in OllamaTranslator.cs) — skip those.
            if not isinstance(el, dict):
                continue
            ko = str(el.get("ko", "")).strip()
            en = str(el.get("en", "")).strip()
            # basic sanity: real Korean, real English, no duplicates
            if len(ko) < 10 or len(en) < 10 or ko in seen:
                continue
            if not any("가" <= ch <= "힣" for ch in ko):
                continue
            seen.add(ko)
            pairs.append((ko, en))
            if len(pairs) >= count:
                break
        print(f"  {ctype}: {len(pairs)}/{count}", flush=True)
    return pairs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen2.5:7b")
    ap.add_argument("--per-type", type=int, default=60)
    args = ap.parse_args()

    DATA_DIR.mkdir(exist_ok=True)

    # Resume: skip types already present in the output file.
    done_types: set[str] = set()
    if OUT_PATH.exists():
        with open(OUT_PATH, encoding="utf-8") as f:
            for row in csv.reader(f, delimiter="\t"):
                if len(row) == 4:
                    done_types.add(row[3])
        if done_types:
            print(f"resuming — already have: {sorted(done_types)}")

    total = 0
    for ctype, (risk, brief) in TARGETS.items():
        if ctype in done_types:
            continue
        t0 = time.time()
        pairs = generate(args.model, ctype, brief, args.per_type)
        with open(OUT_PATH, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter="\t")
            for ko, en in pairs:
                w.writerow([ko, "ko", risk, ctype])
                w.writerow([en, "en", risk, ctype])
        total += len(pairs)
        print(f"{ctype}: {len(pairs)} clauses in {time.time() - t0:.0f}s", flush=True)

    print(f"Done: {total} synthetic clauses → {OUT_PATH}")


if __name__ == "__main__":
    main()
