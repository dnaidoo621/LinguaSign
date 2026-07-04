"""
Fine-tune a multilingual encoder for on-device clause risk classification.

Two heads over a shared encoder:
  - risk:  none / low / medium / high            (4-way)
  - type:  AUTO_RENEWAL ... PAYMENT / IP / NONE   (12-way)

One model handles both the Korean source and the English translation (multilingual
encoder, trained on both sides with shared labels).

Usage:
    python train_classifier.py [--data data/risk_labeled.tsv] [--epochs 4]
                               [--base microsoft/Multilingual-MiniLM-L12-H384]
Output: models/risk-classifier/   (encoder + heads + tokenizer + labels.json)
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import random

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModel, AutoTokenizer

RISKS = ["none", "low", "medium", "high"]
TYPES = [
    "NONE", "AUTO_RENEWAL", "PENALTY", "NON_COMPETE", "LIABILITY", "ARBITRATION",
    "TERMINATION", "DEPOSIT", "CONFIDENTIALITY", "GOVERNING_LAW", "PAYMENT", "IP",
]
_SEVERITY = {r: i for i, r in enumerate(RISKS)}


class ClauseDataset(Dataset):
    def __init__(self, rows: list[tuple[str, int, int]], tokenizer, max_len: int = 256):
        self.rows = rows
        self.tok = tokenizer
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int):
        text, risk, ctype = self.rows[i]
        enc = self.tok(text, truncation=True, max_length=self.max_len,
                       padding="max_length", return_tensors="pt")
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "risk": torch.tensor(risk),
            "ctype": torch.tensor(ctype),
        }


class RiskClassifier(nn.Module):
    """Shared encoder + two linear heads (mean-pooled)."""

    def __init__(self, base: str):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base)
        hidden = self.encoder.config.hidden_size
        self.risk_head = nn.Linear(hidden, len(RISKS))
        self.type_head = nn.Linear(hidden, len(TYPES))

    def forward(self, input_ids, attention_mask):
        out = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        hidden = out.last_hidden_state
        mask = attention_mask.unsqueeze(-1).float()
        pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-6)
        return self.risk_head(pooled), self.type_head(pooled)


def load_rows(path: pathlib.Path) -> list[tuple[str, int, int]]:
    rows: list[tuple[str, int, int]] = []
    dropped = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) != 4:
                continue
            text, _lang, risk, ctype = row
            if risk not in _SEVERITY or ctype not in TYPES:
                dropped += 1
                continue
            # Consistency filter: a clause with no recognized type cannot be medium/high risk.
            if ctype == "NONE" and _SEVERITY[risk] >= 2:
                dropped += 1
                continue
            rows.append((text, _SEVERITY[risk], TYPES.index(ctype)))
    print(f"loaded {len(rows)} rows ({dropped} dropped by filters)")
    return rows


def evaluate(model, loader, device) -> dict[str, float]:
    model.eval()
    risk_ok = type_ok = n = 0
    with torch.no_grad():
        for batch in loader:
            ids = batch["input_ids"].to(device)
            am = batch["attention_mask"].to(device)
            r_logits, t_logits = model(ids, am)
            risk_ok += (r_logits.argmax(-1).cpu() == batch["risk"]).sum().item()
            type_ok += (t_logits.argmax(-1).cpu() == batch["ctype"]).sum().item()
            n += len(batch["risk"])
    return {"risk_acc": risk_ok / n, "type_acc": type_ok / n}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", nargs="+", default=["data/risk_labeled.tsv"],
                    help="one or more TSV files (text, lang, risk, type)")
    ap.add_argument("--base", default="microsoft/Multilingual-MiniLM-L12-H384")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--output", default="models/risk-classifier")
    args = ap.parse_args()

    device = torch.device(
        "mps" if torch.backends.mps.is_available()
        else "cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")

    rows = [r for p in args.data for r in load_rows(pathlib.Path(p))]
    random.Random(42).shuffle(rows)
    split = max(1, int(len(rows) * 0.1))
    eval_rows, train_rows = rows[:split], rows[split:]

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    train_dl = DataLoader(ClauseDataset(train_rows, tokenizer),
                          batch_size=args.batch_size, shuffle=True)
    eval_dl = DataLoader(ClauseDataset(eval_rows, tokenizer), batch_size=args.batch_size)

    model = RiskClassifier(args.base).to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr)
    loss_fn = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        for step, batch in enumerate(train_dl):
            ids = batch["input_ids"].to(device)
            am = batch["attention_mask"].to(device)
            r_logits, t_logits = model(ids, am)
            loss = loss_fn(r_logits, batch["risk"].to(device)) \
                 + loss_fn(t_logits, batch["ctype"].to(device))
            loss.backward()
            optim.step()
            optim.zero_grad()
            total += loss.item()
            if step % 20 == 0:
                print(f"epoch {epoch + 1} step {step}/{len(train_dl)} loss {loss.item():.4f}",
                      flush=True)
        metrics = evaluate(model, eval_dl, device)
        print(f"epoch {epoch + 1}: train_loss {total / len(train_dl):.4f}  {metrics}", flush=True)

    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out / "model.pt")
    tokenizer.save_pretrained(out)
    (out / "labels.json").write_text(json.dumps({"risks": RISKS, "types": TYPES}))
    (out / "base.txt").write_text(args.base)
    print(f"saved → {out}")


if __name__ == "__main__":
    main()
