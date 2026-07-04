/**
 * On-device OCR via ML Kit Text Recognition v2 (Korean script model).
 * Replaces the Surya sidecar; returns blocks with bounding boxes in the same
 * shape the rest of the pipeline expects.
 */

import TextRecognition, {
  TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";

export interface OcrBlock {
  id: string;
  text: string;
  /** Bounding box in image pixel coordinates. */
  bbox: { x: number; y: number; width: number; height: number } | null;
}

export async function recognizeKorean(imageUri: string): Promise<OcrBlock[]> {
  const result = await TextRecognition.recognize(
    imageUri,
    TextRecognitionScript.KOREAN,
  );
  return result.blocks
    .filter((b) => b.text.trim().length > 0)
    .map((b, i) => ({
      id: `block-${i}`,
      text: b.text.replace(/\n+/g, " ").trim(),
      bbox: b.frame
        ? {
            x: b.frame.left,
            y: b.frame.top,
            width: b.frame.width,
            height: b.frame.height,
          }
        : null,
    }));
}
