"""
Dump a SentencePiece model to JSON for the mobile TypeScript tokenizer
(Viterbi unigram encoder — no native sentencepiece dependency on device).

Usage: python export_sp_json.py models-mobile/ko-en/source.spm > source_sp.json
       python export_sp_json.py models-mobile/ko-en   # writes source_sp.json + target_sp.json
"""

from __future__ import annotations

import json
import pathlib
import sys

import sentencepiece as spm


def dump(spm_path: pathlib.Path) -> None:
    sp = spm.SentencePieceProcessor(model_file=str(spm_path))
    pieces = [[sp.id_to_piece(i), sp.get_score(i)] for i in range(sp.get_piece_size())]
    out = spm_path.with_suffix("").parent / (spm_path.stem + "_sp.json")
    out.write_text(json.dumps({"pieces": pieces}, ensure_ascii=False))
    print(f"{spm_path.name}: {sp.get_piece_size()} pieces → {out.name} "
          f"({out.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    target = pathlib.Path(sys.argv[1])
    if target.is_dir():
        for name in ("source.spm", "target.spm"):
            if (target / name).exists():
                dump(target / name)
    else:
        dump(target)


if __name__ == "__main__":
    main()
