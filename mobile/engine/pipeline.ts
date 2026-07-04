/**
 * Document processing pipeline — the on-device equivalent of the server's
 * OCR → translate → analyze Hangfire chain.
 *
 * Memory discipline: stages run SEQUENTIALLY and each model is released before
 * the next loads, so peak RSS stays bounded by the largest single stage
 * (translation, ~350 MB) rather than the sum.
 */

import * as ort from "onnxruntime-react-native";

import { makeBackend } from "./ort";
import { modelPath, readModelJson } from "./assets";
import { OcrBlock, recognizeKorean } from "./ocr";
import { MarianTranslator } from "./translate/marian";
import { SpModel } from "./translate/sentencepiece";
import { Finding, RiskClassifier } from "./risk/classifier";
import { RiskLevel } from "./risk/rules";

export interface ProcessedBlock extends OcrBlock {
  translation: string;
  finding: Finding;
}

export type PipelineStage = "ocr" | "translate" | "analyze" | "done";

export async function processDocumentImage(
  imageUri: string,
  onStage?: (stage: PipelineStage, done: number, total: number) => void,
): Promise<ProcessedBlock[]> {
  const backend = makeBackend(ort as never);

  // --- Stage 1: OCR (ML Kit, OS-managed memory) ---
  onStage?.("ocr", 0, 1);
  const blocks = await recognizeKorean(imageUri);
  if (blocks.length === 0) return [];

  // --- Stage 2: translation (load → run → release) ---
  const marianConfig = await readModelJson<{ eos_token_id?: number; pad_token_id?: number }>(
    "ko-en/config.json",
  );
  const translator = new MarianTranslator(backend, {
    encoderPath: modelPath("ko-en/encoder_model_quantized.onnx"),
    decoderPath: modelPath("ko-en/decoder_model_quantized.onnx"),
    sourceSp: await readModelJson<SpModel>("ko-en/source_sp.json"),
    targetSp: await readModelJson<SpModel>("ko-en/target_sp.json"),
    vocab: await readModelJson<Record<string, number>>("ko-en/vocab.json"),
    config: {
      eosTokenId: marianConfig.eos_token_id ?? 0,
      padTokenId: marianConfig.pad_token_id ?? 65000,
      maxLength: 128,
    },
  });
  const translations: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    onStage?.("translate", i, blocks.length);
    translations.push(await translator.translate(blocks[i].text));
  }
  translator.release();

  // --- Stage 3: risk analysis (load → run → release) ---
  const tokenizer = await readModelJson<{
    sp: SpModel;
    vocab: Record<string, number>;
    bosId: number;
    eosId: number;
    unkId: number;
  }>("risk/tokenizer_mobile.json");
  const labels = await readModelJson<{ risks: RiskLevel[]; types: string[] }>(
    "risk/labels.json",
  );
  const classifier = new RiskClassifier(backend, {
    modelPath: modelPath("risk/risk_classifier_quantized.onnx"),
    sp: tokenizer.sp,
    vocab: tokenizer.vocab,
    bosId: tokenizer.bosId,
    eosId: tokenizer.eosId,
    unkId: tokenizer.unkId,
    risks: labels.risks,
    types: labels.types,
  });
  const results: ProcessedBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    onStage?.("analyze", i, blocks.length);
    const finding = await classifier.analyze(blocks[i].text, translations[i]);
    results.push({ ...blocks[i], translation: translations[i], finding });
  }
  classifier.release();

  onStage?.("done", 1, 1);
  return results;
}
