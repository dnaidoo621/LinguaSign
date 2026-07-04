"""
Export MarianMT ko-en to ONNX INT8 for the mobile app (onnxruntime-react-native).

Produces the same layout the onnx-community/opus-mt-* models use:
  models-mobile/ko-en/
    encoder_model_quantized.onnx
    decoder_model_merged_quantized.onnx   (with-past + without-past merged; INT8)
    source.spm / target.spm / vocab.json / tokenizer_config.json / config.json

Usage:
    python export_mobile.py                                   # base Helsinki-NLP/opus-mt-ko-en
    python export_mobile.py --source models/ko-en-finetuned   # fine-tuned checkpoint
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil

from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.onnxruntime import ORTModelForSeq2SeqLM
from transformers import MarianTokenizer

OUT_ROOT = pathlib.Path(__file__).parent / "models-mobile"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="Helsinki-NLP/opus-mt-ko-en",
                    help="HF model id or local fine-tuned checkpoint dir")
    ap.add_argument("--pair", default="ko-en")
    args = ap.parse_args()

    out_dir = OUT_ROOT / args.pair
    tmp_dir = OUT_ROOT / f"{args.pair}-fp32-tmp"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Exporting {args.source} → ONNX (fp32, merged decoder)...")
    model = ORTModelForSeq2SeqLM.from_pretrained(args.source, export=True)
    model.save_pretrained(tmp_dir)
    tokenizer = MarianTokenizer.from_pretrained(args.source)
    tokenizer.save_pretrained(out_dir)

    # Dynamic INT8 quantization of encoder + merged decoder.
    for name in ("encoder_model", "decoder_model_merged"):
        src = tmp_dir / f"{name}.onnx"
        if not src.exists():
            # optimum may emit decoder_model.onnx + decoder_with_past_model.onnx instead
            # of a merged file depending on version — fall back to quantizing whatever exists.
            candidates = sorted(tmp_dir.glob("decoder*.onnx")) if "decoder" in name else []
            if not candidates:
                raise FileNotFoundError(f"{src} not found; contents: {list(tmp_dir.iterdir())}")
            for c in candidates:
                _quantize(c, out_dir / f"{c.stem}_quantized.onnx")
            continue
        _quantize(src, out_dir / f"{name}_quantized.onnx")

    # Copy config for the JS decode loop (eos/pad/decoder_start ids, max_length).
    shutil.copy(tmp_dir / "config.json", out_dir / "config.json")
    if (tmp_dir / "generation_config.json").exists():
        shutil.copy(tmp_dir / "generation_config.json", out_dir / "generation_config.json")

    shutil.rmtree(tmp_dir)

    sizes = {f.name: round(f.stat().st_size / 1e6, 1) for f in sorted(out_dir.iterdir())}
    print(json.dumps(sizes, indent=2))
    print(f"Done → {out_dir}")


def _quantize(src: pathlib.Path, dst: pathlib.Path) -> None:
    print(f"  INT8 quantize {src.name} → {dst.name}")
    quantize_dynamic(str(src), str(dst), weight_type=QuantType.QUInt8,
                     extra_options={"EnableSubgraph": True})


if __name__ == "__main__":
    main()
