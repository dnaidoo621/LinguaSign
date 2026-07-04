/**
 * On-device clause risk classifier (fine-tuned multilingual encoder, ONNX INT8).
 * Classifies BOTH the Korean source and English translation; final finding is the
 * max-severity merge of classifier output and deterministic rules (same behavior
 * as the server's AnalysisProcessingService).
 */

import { OrtBackend, OrtSession } from "../ort";
import { SentencePieceEncoder, SpModel } from "../translate/sentencepiece";
import { RiskLevel, rulesDetect, SEVERITY } from "./rules";
import { explain } from "./templates";

export interface ClassifierAssets {
  modelPath: string;
  /** SentencePiece dump of the encoder tokenizer (unigram). */
  sp: SpModel;
  /** piece → HF token id (handles XLM-R fairseq offset at export time). */
  vocab: Record<string, number>;
  bosId: number;
  eosId: number;
  unkId: number;
  risks: RiskLevel[];
  types: string[];
  maxLen?: number;
}

export interface Finding {
  level: RiskLevel;
  type: string;
  explanation: string;
  source: "classifier" | "rules";
}

export class RiskClassifier {
  private session!: OrtSession;
  private sp: SentencePieceEncoder;
  private loaded = false;

  constructor(
    private backend: OrtBackend,
    private assets: ClassifierAssets,
  ) {
    this.sp = new SentencePieceEncoder(assets.sp);
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.session = await this.backend.createSession(this.assets.modelPath);
    this.loaded = true;
  }

  release(): void {
    (this.session as unknown as { release?: () => void })?.release?.();
    this.loaded = false;
  }

  private encode(text: string): number[] {
    const { vocab, bosId, eosId, unkId, maxLen = 256 } = this.assets;
    const ids = this.sp
      .encodePieces(text)
      .map((p) => (vocab[p] !== undefined ? vocab[p] : unkId));
    return [bosId, ...ids.slice(0, maxLen - 2), eosId];
  }

  /** Raw classifier output for one text. */
  async classify(text: string): Promise<{ level: RiskLevel; type: string }> {
    await this.load();
    const ids = this.encode(text);
    const n = ids.length;
    const out = await this.session.run({
      input_ids: this.backend.tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, n]),
      attention_mask: this.backend.tensor(
        "int64",
        BigInt64Array.from({ length: n }, () => 1n),
        [1, n],
      ),
    });
    const riskLogits = out.risk_logits.data as Float32Array;
    const typeLogits = out.type_logits.data as Float32Array;
    return {
      level: this.assets.risks[argmax(riskLogits)],
      type: this.assets.types[argmax(typeLogits)],
    };
  }

  /**
   * Full finding for a clause: classify Korean source + English translation,
   * merge with deterministic rules by max severity.
   */
  async analyze(koText: string, enText: string): Promise<Finding> {
    const [koRes, enRes] = [await this.classify(koText), await this.classify(enText)];
    const cls = SEVERITY[koRes.level] >= SEVERITY[enRes.level] ? koRes : enRes;
    const rules = rulesDetect(enText);

    const useRules = SEVERITY[rules.level] > SEVERITY[cls.level];
    const level = useRules ? rules.level : cls.level;
    const type = useRules ? rules.type : cls.type;
    return { level, type, explanation: explain(type), source: useRules ? "rules" : "classifier" };
  }
}

function argmax(a: Float32Array): number {
  let best = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[best]) best = i;
  return best;
}
