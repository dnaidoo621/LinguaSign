# LinguaSign Mobile

Single-app, fully on-device version of LinguaSign: OCR → Korean→English translation →
risk analysis, all offline. See [docs/mobile-architecture.md](../docs/mobile-architecture.md)
for the design and memory budget.

## Stack

- **Expo / React Native** (TypeScript)
- **ML Kit Text Recognition v2** (Korean) — on-device OCR
- **MarianMT ko-en, ONNX INT8** via `onnxruntime-react-native` — our fine-tuned
  translation model, exported by `ml/translation-sidecar/export_mobile.py`
- **Risk classifier** (fine-tuned Multilingual MiniLM, ONNX INT8) + deterministic
  rules + template explanations — trained by `ml/risk-classifier/`

## Engine layout

```
engine/
  ort.ts                    # ORT backend abstraction (react-native ↔ node)
  assets.ts                 # first-launch model download (models are not bundled)
  ocr/                      # ML Kit wrapper → OcrBlock[]
  translate/
    sentencepiece.ts        # pure-TS SentencePiece unigram (Viterbi) tokenizer
    glossary.ts             # port of ml/translation-sidecar/glossary.py
    marian.ts               # greedy decode + glossary target-prefix constraint
  risk/
    rules.ts                # port of backend RiskRules.cs
    templates.ts            # per-type plain-language explanations
    classifier.ts           # ONNX classifier + max-severity merge with rules
  pipeline.ts               # sequential OCR → translate → analyze (bounded memory)
```

## Run the engine without a device (Node)

The engine is pure TypeScript; the same code runs under `onnxruntime-node`:

```bash
npm install
npx tsx engine/__tests__/translate.e2e.ts
```

Requires the exported models at `../ml/translation-sidecar/models-mobile/ko-en/`
(`python export_mobile.py && python export_sp_json.py models-mobile/ko-en`).

## Run the app

Native modules (ML Kit, onnxruntime) mean Expo Go won't work — build a dev client:

```bash
npx expo prebuild
npx expo run:ios      # or run:android
```

Models (~250 MB) download on first "Scan a document" tap; set `MODEL_BASE_URL` in
`engine/assets.ts` to wherever the exported models are hosted (HF Hub repo).
