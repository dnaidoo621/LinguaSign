/**
 * MarianMT ko→en inference over ONNX Runtime — greedy decode with glossary
 * target-prefix constraint (mobile equivalent of the CTranslate2 sidecar).
 *
 * Uses encoder_model_quantized.onnx + decoder_model_quantized.onnx (no past-KV:
 * simpler and adequate for clause-length blocks; past-KV variant is a later
 * optimization — the file is already exported).
 */

import { OrtBackend, OrtSession, OrtTensor } from "../ort";
import { getTargetPrefix, postProcess } from "./glossary";
import { decodePieces, SentencePieceEncoder, SpModel } from "./sentencepiece";

export interface MarianConfig {
  eosTokenId: number; // </s>
  padTokenId: number; // <pad> — also decoder_start_token_id for Marian
  maxLength: number;
}

export interface MarianAssets {
  encoderPath: string;
  decoderPath: string;
  /** JSON dumps from export_sp_json.py */
  sourceSp: SpModel;
  targetSp: SpModel;
  /** Marian vocab.json: piece → id (shared src/tgt vocabulary) */
  vocab: Record<string, number>;
  config: MarianConfig;
}

const NO_REPEAT_NGRAM = 4;

export class MarianTranslator {
  private encoder!: OrtSession;
  private decoder!: OrtSession;
  private srcSp: SentencePieceEncoder;
  private tgtSp: SentencePieceEncoder;
  private vocab: Record<string, number>;
  private idToPiece: string[] = [];
  private cfg: MarianConfig;
  private loaded = false;

  constructor(
    private backend: OrtBackend,
    private assets: MarianAssets,
  ) {
    this.srcSp = new SentencePieceEncoder(assets.sourceSp);
    this.tgtSp = new SentencePieceEncoder(assets.targetSp);
    this.vocab = assets.vocab;
    this.cfg = assets.config;
    for (const [piece, id] of Object.entries(assets.vocab)) this.idToPiece[id] = piece;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.encoder = await this.backend.createSession(this.assets.encoderPath);
    this.decoder = await this.backend.createSession(this.assets.decoderPath);
    this.loaded = true;
  }

  /** Free sessions between pipeline stages to keep peak memory low. */
  release(): void {
    // ORT JS sessions have release() in both node and react-native flavors.
    (this.encoder as unknown as { release?: () => void })?.release?.();
    (this.decoder as unknown as { release?: () => void })?.release?.();
    this.loaded = false;
  }

  private pieceId(piece: string): number {
    const id = this.vocab[piece];
    return id !== undefined ? id : (this.vocab["<unk>"] ?? 0);
  }

  private encodeSource(text: string): number[] {
    const pieces = this.srcSp.encodePieces(text);
    return [...pieces.map((p) => this.pieceId(p)), this.cfg.eosTokenId];
  }

  /** Tokens forced at the start of decoding when a glossary term opens the block. */
  private prefixIds(text: string, src: string, tgt: string): number[] {
    const phrase = getTargetPrefix(text, src, tgt);
    if (!phrase) return [];
    return this.tgtSp.encodePieces(phrase).map((p) => this.pieceId(p));
  }

  async translate(text: string, src = "ko", tgt = "en"): Promise<string> {
    await this.load();
    const inputIds = this.encodeSource(text);
    const seqLen = inputIds.length;

    const ids64 = BigInt64Array.from(inputIds.map(BigInt));
    const mask64 = BigInt64Array.from({ length: seqLen }, () => 1n);
    const inputTensor = this.backend.tensor("int64", ids64, [1, seqLen]);
    const maskTensor = this.backend.tensor("int64", mask64, [1, seqLen]);

    const encOut = await this.encoder.run({
      input_ids: inputTensor,
      attention_mask: maskTensor,
    });
    const hiddenName = this.encoder.outputNames.includes("last_hidden_state")
      ? "last_hidden_state"
      : this.encoder.outputNames[0];
    const encoderHidden = encOut[hiddenName];

    // Greedy decode, seeded with decoder_start (= pad for Marian) + glossary prefix.
    const forced = this.prefixIds(text, src, tgt);
    const decoded: number[] = [this.cfg.padTokenId, ...forced];

    while (decoded.length < this.cfg.maxLength) {
      const dec64 = BigInt64Array.from(decoded.map(BigInt));
      const out = await this.decoder.run({
        input_ids: this.backend.tensor("int64", dec64, [1, decoded.length]),
        encoder_attention_mask: maskTensor,
        encoder_hidden_states: encoderHidden,
      });
      const logits = out[this.decoder.outputNames.includes("logits") ? "logits" : this.decoder.outputNames[0]];
      const next = this.pickNext(logits, decoded);
      if (next === this.cfg.eosTokenId) break;
      decoded.push(next);
    }

    const pieces = decoded
      .slice(1) // drop decoder_start
      .map((id) => this.idToPiece[id] ?? "")
      .filter((p) => p && !p.startsWith("<"));
    const raw = decodePieces(pieces);
    return postProcess(text, raw, src, tgt);
  }

  /** Argmax over last-step logits with no-repeat-ngram blocking. */
  private pickNext(logits: OrtTensor, decoded: number[]): number {
    const [, steps, vocabSize] = logits.dims as number[];
    const data = logits.data as Float32Array;
    const offset = (steps - 1) * vocabSize;

    const banned = this.bannedTokens(decoded);
    let best = -1;
    let bestScore = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      if (banned.has(v)) continue;
      const s = data[offset + v];
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    return best;
  }

  /** Tokens that would complete an already-seen n-gram of size NO_REPEAT_NGRAM. */
  private bannedTokens(decoded: number[]): Set<number> {
    const banned = new Set<number>();
    const n = NO_REPEAT_NGRAM;
    if (decoded.length < n - 1) return banned;
    const prefix = decoded.slice(decoded.length - (n - 1)).join(",");
    for (let i = 0; i + n <= decoded.length; i++) {
      if (decoded.slice(i, i + n - 1).join(",") === prefix) {
        banned.add(decoded[i + n - 1]);
      }
    }
    return banned;
  }
}
