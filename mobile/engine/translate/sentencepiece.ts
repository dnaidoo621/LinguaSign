/**
 * Minimal SentencePiece *unigram* encoder/decoder in pure TypeScript.
 *
 * Reads the JSON dump produced by ml/translation-sidecar/export_sp_json.py
 * ({ pieces: [piece, score][] }) and runs Viterbi segmentation — the same
 * algorithm SentencePiece uses at inference time, so output pieces match the
 * Python `sentencepiece` library for unigram models (Marian source/target.spm,
 * XLM-R style tokenizers).
 *
 * No native dependencies — runs under Hermes (React Native) and Node alike.
 */

const SPACE = "▁"; // ▁

export interface SpModel {
  pieces: [string, number][];
}

export class SentencePieceEncoder {
  private scores = new Map<string, number>();
  private maxPieceLen = 1;
  /** score assigned to a single unknown character (matches spm's unk penalty spirit) */
  private readonly unkScore: number;

  constructor(model: SpModel) {
    let min = 0;
    for (const [piece, score] of model.pieces) {
      // Control pieces (<unk>, <s>, </s>, <pad>) never match raw text.
      if (piece.startsWith("<") && piece.endsWith(">")) continue;
      this.scores.set(piece, score);
      if (piece.length > this.maxPieceLen) this.maxPieceLen = piece.length;
      if (score < min) min = score;
    }
    this.unkScore = min - 10;
  }

  /** Normalize + segment text into sentencepiece surface pieces. */
  encodePieces(text: string): string[] {
    // SentencePiece default normalization relevant to us: collapse whitespace,
    // add dummy prefix, encode spaces as ▁.
    const normalized = SPACE + text.trim().replace(/\s+/g, SPACE);
    const chars = Array.from(normalized); // code-point safe
    const n = chars.length;

    // Viterbi: best[i] = best score of a segmentation of chars[0..i)
    const best = new Float64Array(n + 1).fill(-Infinity);
    const backPiece: string[] = new Array(n + 1).fill("");
    const backFrom = new Int32Array(n + 1).fill(-1);
    best[0] = 0;

    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      let sub = "";
      for (let j = i; j < Math.min(n, i + this.maxPieceLen); j++) {
        sub += chars[j];
        const score = this.scores.get(sub);
        if (score !== undefined) {
          const cand = best[i] + score;
          if (cand > best[j + 1]) {
            best[j + 1] = cand;
            backPiece[j + 1] = sub;
            backFrom[j + 1] = i;
          }
        }
      }
      // Unknown single-character fallback keeps segmentation total.
      const cand = best[i] + this.unkScore;
      if (cand > best[i + 1]) {
        best[i + 1] = cand;
        backPiece[i + 1] = chars[i];
        backFrom[i + 1] = i;
      }
    }

    const pieces: string[] = [];
    for (let i = n; i > 0; i = backFrom[i]) pieces.push(backPiece[i]);
    return pieces.reverse();
  }

  /** True if the piece exists in the model vocabulary. */
  has(piece: string): boolean {
    return this.scores.has(piece);
  }
}

/** Join pieces back into text (▁ → space). */
export function decodePieces(pieces: string[]): string {
  return pieces.join("").replaceAll(SPACE, " ").trim();
}
