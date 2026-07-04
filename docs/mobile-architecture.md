# LinguaSign Mobile — Single-App, Fully On-Device Architecture

Goal: run the entire LinguaSign pipeline — OCR → translation → risk analysis → signing → export —
inside **one mobile app**, offline-capable, with a peak memory budget that fits comfortably on a
3–4 GB Android phone or any iPhone from the last ~6 years. No sidecars, no Ollama, no server
required for the core flow (Supabase stays optional for auth + sync).

---

## Component decisions

| Pipeline stage | Server stack (today) | Mobile replacement | Size on disk | Peak RAM |
|---|---|---|---|---|
| OCR | Surya sidecar (Python, ~3 GB) | **ML Kit Text Recognition v2** (Korean script) — on-device, free, both platforms | ~4 MB per script (bundled) | ~80–120 MB transient |
| Translation ko→en | MarianMT + CTranslate2 sidecar | **Same fine-tuned MarianMT, exported to ONNX INT8**, run via `onnxruntime-react-native` | ~90–110 MB (encoder + merged decoder, INT8) | ~250–350 MB during inference |
| Glossary | Python `glossary.py` | Direct TypeScript port (target-prefix via forced decoder tokens + post-substitution) | ~0 | ~0 |
| Risk analysis | Ollama qwen2.5:7b (~4 GB) | **Our own fine-tuned classifier**: Multilingual MiniLM (or XtremeDistil) with 2 heads (risk level, clause type) → ONNX INT8. Explanations = per-type templates + existing `RiskRules` keyword pass ported to TS | ~25–120 MB | ~60–150 MB |
| PDF read/render | backend + pdfium | `react-native-pdf` (render) + `pdf-lib` (manipulate — pure JS, works in RN) | — | ~50 MB |
| Signing + stamp | backend PDF stamping | `pdf-lib` draw signature image + audit page client-side | — | small |
| Storage | Postgres | SQLite (`expo-sqlite` / `react-native-quick-sqlite`) | — | small |
| Auth (optional) | Supabase JWT | Supabase JS SDK (only when online sync is wanted) | — | small |

**Sequential execution is the memory trick**: the pipeline never runs two models at once.
OCR completes and releases → translation session loads, runs, unloads → classifier runs.
Worst single moment is translation at ~350 MB; total app peak stays **under ~600 MB**,
inside iOS jetsam limits and Android low-RAM device budgets.

## Why not a tiny on-device LLM for risk analysis?

Researched options, in order of rejection:

1. **OS-provided models** (Apple Foundation Models on iOS 26+, Gemini Nano via ML Kit GenAI):
   free and zero-download, but device-gated (Apple Intelligence hardware only / flagship
   Androids), API surface differs per platform, and no control over legal-domain quality in
   Korean. Fine as a *future optional enhancement* tier, not the base.
2. **1B-class GGUF LLM via llama.cpp / ExecuTorch** (Qwen3 0.6B, Llama 3.2 1B, Gemma 3 1B):
   runs (~500–700 MB RAM at Q4, 3–15 tok/s), but that's most of our memory budget, causes
   thermal throttling on sustained multi-clause analysis, and small models are unreliable at
   producing strict JSON risk taxonomies.
3. **Fine-tuned encoder classifier (CHOSEN)**: risk analysis in LinguaSign is fundamentally
   *classification* — `risk ∈ {none, low, medium, high}` × `type ∈ {AUTO_RENEWAL, PENALTY, …}`.
   The server already treats the LLM as a classifier with a one-sentence explanation, and it
   already has a deterministic-rules fallback (`RiskRules.cs`). A ~25–120 MB INT8 encoder gives
   deterministic ~10–50 ms/clause inference, no hallucination, no thermal issues. Explanations
   come from curated per-type templates (the explanation text for e.g. AUTO_RENEWAL barely
   varies between documents).

### Classifier training plan

- **Labels**: generate with the *existing server LLM path* — run qwen2.5:7b over our corpus
  (420 synthetic legal pairs + 3,251-pair legal_train set + rule-matched clauses) with the same
  prompt schema as `OllamaClauseAnalyzer`, keep only labels where the deterministic
  `RiskRules` pass agrees or the LLM is confident, giving a few thousand
  (clause_text, risk, type) rows in both Korean and English.
- **Base model**: `microsoft/Multilingual-MiniLM-L12-H384` (117 M params, 100+ languages —
  one model classifies both the Korean source and English translation) with two linear heads.
  If size matters more than accuracy: `xtremedistil-l6-h256` (~22 M params → ~25 MB INT8).
- **Train**: minutes on the M-series Mac (MPS), standard HF `Trainer`.
- **Export**: Optimum → ONNX → dynamic INT8 quantization → `onnxruntime-react-native`.
- **Runtime merge** (port of server behavior): `max(rules_result, classifier_result)` by
  severity — rules still guard against false negatives.

## Translation on mobile

- Export our (fine-tuned) `Helsinki-NLP/opus-mt-ko-en` with **HF Optimum** to
  `encoder_model.onnx` + `decoder_model_merged.onnx`, INT8-quantized — the exact format the
  `@xenova/transformers` / onnx-community `opus-mt-*` models ship in, proving Marian works
  quantized in ONNX.
- Greedy/short-beam decode loop implemented in TypeScript over the two ORT sessions
  (encoder once per block; decoder steps with past-KV). `target_prefix` glossary constraint
  becomes "seed the decoder input with forced tokens" — same effect as CTranslate2.
- SentencePiece tokenization via a small JS/WASM sentencepiece port, using the same
  `source.spm` / `target.spm` files.
- Bergamot/Firefox-translations was evaluated (fastest mobile NMT runtime) but has **no ko-en
  model** and can't load our fine-tuned Marian weights in ONNX form — rejected.

## OCR on mobile

- **ML Kit Text Recognition v2** with the Korean script model, via
  `@react-native-ml-kit/text-recognition` — same engine on Android and iOS, returns blocks
  with bounding boxes (matches our existing block model from Surya).
- Digital PDFs skip OCR entirely: extract the text layer directly; only scanned pages get
  rendered to bitmaps (one page at a time — bounded memory) and OCR'd.
- Apple Vision (`VNRecognizeTextRequest`) also supports Korean and is a fine iOS-only
  alternative, but ML Kit keeps one code path for both platforms.

## App framework

**React Native + Expo (dev client)**. Reasons:
- Reuses the TypeScript domain logic, API types, and design tokens from the Next.js frontend.
- First-class libraries for every hard piece: `onnxruntime-react-native`,
  `@react-native-ml-kit/text-recognition`, `react-native-pdf`, `pdf-lib`, `expo-sqlite`.
- `react-native-executorch` (Software Mansion) is a promising alternative runtime (has
  useOCR/useLLM hooks) and can be adopted later without changing app structure.
- Native modules stay isolated behind an `engine/` interface so any stage can be swapped
  (e.g. Apple FM explanations tier later).

## Package layout

```
mobile/
  app/                  # expo-router screens: Home, Scan, Reader, Sign, Export
  engine/
    ocr/                # ML Kit wrapper → OcrBlock[]
    translate/          # ORT sessions, sp tokenizer, decode loop, glossary.ts
    risk/               # classifier session + rules.ts + explanation templates
    pdf/                # render, text-layer extraction, signing stamp, export
  db/                   # SQLite schema + repositories (documents, blocks, findings, audit)
  models/               # downloaded at first run (or bundled): marian-ko-en/, risk-minilm/
```

Models ship via **first-launch download** (~130–230 MB total) with checksums, not in the app
binary — keeps store download small and lets us push model updates without app releases.

## Memory budget summary

| Phase | Resident |
|---|---|
| Idle / reading | ~200 MB (RN runtime + PDF page cache) |
| OCR page burst | ~300 MB |
| Translation burst | ~500–550 MB |
| Risk classification | ~350 MB |

Target devices: any iPhone with ≥3 GB RAM (iPhone XR+), Android ≥4 GB.

## What stays server-side (optional tier)

Nothing is *required*, but when online: Supabase auth + document sync, and optionally the
existing server pipeline as a "high quality" mode (bigger LLM explanations). The mobile app is
the offline-first product; the web app remains the desktop experience.

## Sources

- [ML Kit Text Recognition v2 (Korean support, on-device)](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [ONNX Runtime React Native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html)
- [ONNX Runtime mobile deployment guide](https://onnxruntime.ai/docs/tutorials/mobile/)
- [onnx-community quantized opus-mt models (proof Marian→ONNX INT8 works)](https://huggingface.co/onnx-community/opus-mt-en-es)
- [Offline OPUS-MT in-browser translator (ONNX INT8)](https://github.com/harisnae/multilingual-translator-offline)
- [react-native-executorch (Software Mansion)](https://github.com/software-mansion/react-native-executorch)
- [Expo blog: running AI models with React Native ExecuTorch](https://expo.dev/blog/how-to-run-ai-models-with-react-native-executorch)
- [Multilingual-MiniLM-L12-H384](https://huggingface.co/microsoft/Multilingual-MiniLM-L12-H384)
- [XtremeDistil transformers](https://github.com/microsoft/xtreme-distil-transformers)
- [Running transformer models on mobile (DistilBERT ONNX INT8 sizing)](https://huggingface.co/blog/tugrulkaya/running-large-transformer-models-on-mobile)
- [ML Kit GenAI APIs / Gemini Nano](https://developers.google.com/ml-kit/genai)
- [Apple Foundation Models framework (iOS 26)](https://firebase.google.com/docs/ai-logic/apple-foundation-models-framework/get-started)
- [On-device LLM guide 2026 (llama.cpp mobile memory/speed)](https://www.buildmvpfast.com/blog/on-device-llm-mobile-llama-ios-android-2026)
- [Bergamot translator (no ko-en — rejected)](https://github.com/browsermt/bergamot-translator)
