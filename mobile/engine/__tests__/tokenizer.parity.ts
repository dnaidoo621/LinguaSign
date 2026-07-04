/**
 * Tokenizer parity check: TS Viterbi unigram encoder vs Python sentencepiece.
 *
 * Generate the reference file first:
 *   cd ml/translation-sidecar && .venv/bin/python - <<'PY' > /tmp/py_pieces.json
 *   import json, sentencepiece as spm
 *   sp = spm.SentencePieceProcessor(model_file="models-mobile/ko-en/source.spm")
 *   tests = ["...", ...]
 *   print(json.dumps({t: sp.encode_as_pieces(t) for t in tests}, ensure_ascii=False))
 *   PY
 *
 * Run: npx tsx engine/__tests__/tokenizer.parity.ts <reference.json>
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { SentencePieceEncoder, SpModel } from "../translate/sentencepiece";

const refPath = process.argv[2];
if (!refPath) {
  console.error("usage: tsx tokenizer.parity.ts <py_pieces.json>");
  process.exit(2);
}

const ref: Record<string, string[]> = JSON.parse(readFileSync(refPath, "utf-8"));
const model: SpModel = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../ml/translation-sidecar/models-mobile/ko-en/source_sp.json"),
    "utf-8",
  ),
);
const enc = new SentencePieceEncoder(model);

let pass = 0;
let fail = 0;
for (const [text, expected] of Object.entries(ref)) {
  const got = enc.encodePieces(text);
  if (JSON.stringify(got) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.log(`MISMATCH: ${text}\n  py: ${expected.join(" ")}\n  ts: ${got.join(" ")}`);
  }
}
console.log(`${pass}/${pass + fail} exact piece matches`);
process.exit(fail === 0 ? 0 : 1);
