"""
Export the trained risk classifier to ONNX INT8 for onnxruntime-react-native.

Output: models/risk-classifier/risk_classifier_quantized.onnx
        (inputs: input_ids, attention_mask int64 [batch, seq];
         outputs: risk_logits [batch,4], type_logits [batch,12])

Usage: python export_classifier.py [--model models/risk-classifier]
"""

from __future__ import annotations

import argparse
import json
import pathlib

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

from train_classifier import RiskClassifier


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="models/risk-classifier")
    args = ap.parse_args()

    model_dir = pathlib.Path(args.model)
    base = (model_dir / "base.txt").read_text().strip()

    model = RiskClassifier(base)
    model.load_state_dict(torch.load(model_dir / "model.pt", map_location="cpu"))
    model.eval()

    dummy_ids = torch.ones(1, 256, dtype=torch.long)
    dummy_mask = torch.ones(1, 256, dtype=torch.long)

    fp32 = model_dir / "risk_classifier.onnx"
    torch.onnx.export(
        model, (dummy_ids, dummy_mask), str(fp32),
        input_names=["input_ids", "attention_mask"],
        output_names=["risk_logits", "type_logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "risk_logits": {0: "batch"},
            "type_logits": {0: "batch"},
        },
        opset_version=17,
    )

    int8 = model_dir / "risk_classifier_quantized.onnx"
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QUInt8)

    sizes = {f.name: round(f.stat().st_size / 1e6, 1)
             for f in sorted(model_dir.glob("*.onnx"))}
    print(json.dumps(sizes, indent=2))


if __name__ == "__main__":
    main()
