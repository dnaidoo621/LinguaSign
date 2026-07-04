/**
 * Model asset management — models are NOT bundled in the app binary (they total
 * ~250 MB); they're downloaded once on first launch into the app's document
 * directory and reused offline afterwards.
 *
 * MODEL_BASE_URL should point at a static host (HF Hub resolve URLs or GitHub
 * Release assets). Files are fetched only if missing.
 */

import { Directory, File, Paths } from "expo-file-system";

// TODO: replace with the HuggingFace repo once models are uploaded
// (e.g. https://huggingface.co/dnaidoo621/linguasign-mobile/resolve/main).
export const MODEL_BASE_URL =
  "https://huggingface.co/dnaidoo621/linguasign-mobile/resolve/main";

export const TRANSLATION_FILES = [
  "ko-en/encoder_model_quantized.onnx",
  "ko-en/decoder_model_quantized.onnx",
  "ko-en/source_sp.json",
  "ko-en/target_sp.json",
  "ko-en/vocab.json",
  "ko-en/config.json",
] as const;

export const RISK_FILES = [
  "risk/risk_classifier_quantized.onnx",
  "risk/tokenizer_mobile.json",
  "risk/labels.json",
] as const;

export const FONT_FILES = [
  // Static TrueType — pdf-lib requires full embed (subsetting breaks CJK)
  // and CFF/variable fonts render blank glyphs.
  "fonts/NanumGothic.ttf",
] as const;

const modelsDir = new Directory(Paths.document, "models");

export function modelPath(relative: string): string {
  return new File(modelsDir, relative).uri.replace("file://", "");
}

export async function ensureModels(
  onProgress?: (file: string, index: number, total: number) => void,
): Promise<void> {
  const all = [...TRANSLATION_FILES, ...RISK_FILES, ...FONT_FILES];
  for (let i = 0; i < all.length; i++) {
    const rel = all[i];
    const file = new File(modelsDir, rel);
    if (file.exists) continue;
    onProgress?.(rel, i + 1, all.length);
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(`${MODEL_BASE_URL}/${rel}`, file);
  }
}

export async function readModelJson<T>(relative: string): Promise<T> {
  const file = new File(modelsDir, relative);
  return JSON.parse(await file.text()) as T;
}
