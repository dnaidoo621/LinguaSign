/**
 * Node e2e for the risk engine — runs classifier.ts (the exact app code) against
 * the exported ONNX INT8 classifier using onnxruntime-node.
 *
 * Run: npx tsx engine/__tests__/risk.e2e.ts <model-dir> <tokenizer_mobile.json>
 *   model-dir must contain risk_classifier_quantized.onnx + labels.json
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-node";

import { makeBackend } from "../ort";
import { RiskClassifier } from "../risk/classifier";

const [modelDir, tokenizerPath] = process.argv.slice(2);
if (!modelDir || !tokenizerPath) {
  console.error("usage: tsx risk.e2e.ts <model-dir> <tokenizer_mobile.json>");
  process.exit(2);
}

const labels = JSON.parse(readFileSync(path.join(modelDir, "labels.json"), "utf-8"));
const tokenizer = JSON.parse(readFileSync(tokenizerPath, "utf-8"));

async function main() {
  const classifier = new RiskClassifier(makeBackend(ort as never), {
    modelPath: path.join(modelDir, "risk_classifier_quantized.onnx"),
    sp: tokenizer.sp,
    vocab: tokenizer.vocab,
    bosId: tokenizer.bosId,
    eosId: tokenizer.eosId,
    unkId: tokenizer.unkId,
    risks: labels.risks,
    types: labels.types,
  });

  const cases: [string, string][] = [
    [
      "본 계약은 자동갱신되며 해지 통보는 30일 전에 하여야 한다.",
      "The contract is automatically renewed and notice must be given 30 days in advance.",
    ],
    ["위약금은 월 임대료의 3배로 한다.", "The penalty is three times the monthly rent."],
    ["준거법은 대한민국법을 따른다.", "The governing law is the law of the Republic of Korea."],
    ["오늘 날씨가 좋습니다.", "The weather is nice today."],
  ];

  for (const [ko, en] of cases) {
    const t0 = Date.now();
    const finding = await classifier.analyze(ko, en);
    console.log(
      `[${Date.now() - t0}ms] ${finding.level.toUpperCase()} ${finding.type} (${finding.source})  ← ${ko}`,
    );
  }
  classifier.release();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
