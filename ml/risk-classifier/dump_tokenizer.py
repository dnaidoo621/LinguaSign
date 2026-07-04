"""
Dump the classifier tokenizer to JSON for the mobile TypeScript engine.

Emits pieces+scores (for Viterbi segmentation) and piece→HF-id vocab (which bakes
in the XLM-R fairseq offset), plus special token ids — everything classifier.ts needs.

Usage: python dump_tokenizer.py [--base microsoft/Multilingual-MiniLM-L12-H384]
                                [--out models/risk-classifier/tokenizer_mobile.json]
"""

from __future__ import annotations

import argparse
import json
import pathlib

from transformers import AutoTokenizer


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="microsoft/Multilingual-MiniLM-L12-H384")
    ap.add_argument("--out", default="models/risk-classifier/tokenizer_mobile.json")
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.base, use_fast=False)
    sp = tok.sp_model  # sentencepiece processor behind XLMRobertaTokenizer (slow)

    pieces = [[sp.id_to_piece(i), sp.get_score(i)] for i in range(sp.get_piece_size())]
    vocab = tok.get_vocab()  # piece → HF id (fairseq offset already applied)

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "sp": {"pieces": pieces},
        "vocab": vocab,
        "bosId": tok.cls_token_id if tok.cls_token_id is not None else tok.bos_token_id,
        "eosId": tok.sep_token_id if tok.sep_token_id is not None else tok.eos_token_id,
        "unkId": tok.unk_token_id,
        "padId": tok.pad_token_id,
    }, ensure_ascii=False))
    print(f"{out} ({out.stat().st_size / 1e6:.1f} MB, {len(pieces)} pieces)")


if __name__ == "__main__":
    main()
