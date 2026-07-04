/**
 * Node e2e for the mobile translation engine — runs the EXACT TypeScript code the
 * app ships (tokenizer, decode loop, glossary) against the exported ONNX INT8
 * models, using onnxruntime-node in place of onnxruntime-react-native.
 *
 * Run: npx tsx engine/__tests__/translate.e2e.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-node";

import { makeBackend } from "../ort";
import { MarianTranslator } from "../translate/marian";

const MODEL_DIR = path.resolve(
  __dirname,
  "../../../ml/translation-sidecar/models-mobile/ko-en",
);

const readJson = (f: string) =>
  JSON.parse(readFileSync(path.join(MODEL_DIR, f), "utf-8"));

async function main() {
  const config = readJson("config.json");
  const translator = new MarianTranslator(
    makeBackend(ort as never),
    {
      encoderPath: path.join(MODEL_DIR, "encoder_model_quantized.onnx"),
      decoderPath: path.join(MODEL_DIR, "decoder_model_quantized.onnx"),
      sourceSp: readJson("source_sp.json"),
      targetSp: readJson("target_sp.json"),
      vocab: readJson("vocab.json"),
      config: {
        eosTokenId: config.eos_token_id ?? 0,
        padTokenId: config.pad_token_id ?? 65000,
        maxLength: 128,
      },
    },
  );

  const cases = [
    "준거법은 대한민국법을 따른다.",
    "임차인은 계약 종료 시 보증금을 반환받는다.",
    "본 계약은 자동갱신되며 해지 통보는 30일 전에 하여야 한다.",
    "위약금은 월 임대료의 3배로 한다.",
    "중재는 대한상사중재원에서 진행한다.",
  ];

  for (const ko of cases) {
    const t0 = Date.now();
    const en = await translator.translate(ko);
    console.log(`[${Date.now() - t0}ms] ${ko}\n  → ${en}\n`);
  }
  translator.release();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
