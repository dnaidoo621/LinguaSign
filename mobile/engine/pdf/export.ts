/**
 * Signed-document PDF export — the on-device replacement for the server's
 * signing/export module. Pure JS (pdf-lib + fontkit), no native deps.
 *
 * Produces:
 *   page 1..n : the scanned document image(s)
 *   then      : bilingual clause review (Korean / English / risk + explanation)
 *   last      : signature block + audit trail (signer, timestamp, doc hash)
 *
 * Korean text requires an embedded CJK font (standard PDF fonts are WinAnsi-only);
 * pass NotoSansKR (or similar) bytes — it ships with the model download bundle.
 */

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

import { ProcessedBlock } from "../pipeline";

const RISK_RGB: Record<string, [number, number, number]> = {
  none: [0.54, 0.56, 0.6],
  low: [0.23, 0.51, 0.96],
  medium: [0.96, 0.62, 0.04],
  high: [0.94, 0.27, 0.27],
};

export interface ExportInput {
  /** Scanned page images (PNG or JPG bytes). */
  pageImages: { bytes: Uint8Array; format: "png" | "jpg" }[];
  blocks: ProcessedBlock[];
  /** Unicode font bytes (e.g. NotoSansKR-Regular.ttf) — required for Korean. */
  fontBytes: Uint8Array;
  signerName: string;
  /** PNG bytes of the drawn signature (optional — omitted = unsigned review copy). */
  signaturePng?: Uint8Array;
  /** SHA-256 hex of the source image(s), for the audit trail. */
  documentHash: string;
  signedAtIso?: string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

export async function exportSignedPdf(input: ExportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // subset:true is broken for CJK fonts in pdf-lib/fontkit (glyphs silently
  // dropped) — embed the full font. NanumGothic adds ~2MB per exported PDF.
  const font = await doc.embedFont(input.fontBytes, { subset: false });

  // --- Document image pages ---
  for (const img of input.pageImages) {
    const embedded =
      img.format === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const page = doc.addPage(A4);
    const scale = Math.min(
      (A4[0] - MARGIN * 2) / embedded.width,
      (A4[1] - MARGIN * 2) / embedded.height,
    );
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, {
      x: (A4[0] - w) / 2,
      y: (A4[1] - h) / 2,
      width: w,
      height: h,
    });
  }

  // --- Bilingual clause review ---
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  y = drawText(page, font, "Clause Review", MARGIN, y, 16);
  y -= 8;

  for (const block of input.blocks) {
    // Estimate height; new page when close to the bottom margin.
    if (y < MARGIN + 120) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN;
    }
    const [r, g, b] = RISK_RGB[block.finding.level] ?? RISK_RGB.none;
    const label =
      block.finding.type !== "NONE"
        ? `${block.finding.level.toUpperCase()} · ${block.finding.type}`
        : block.finding.level.toUpperCase();
    page.drawText(label, { x: MARGIN, y, size: 9, font, color: rgb(r, g, b) });
    y -= 14;
    y = drawWrapped(page, font, block.text, MARGIN, y, 10, A4[0] - MARGIN * 2);
    y = drawWrapped(page, font, block.translation, MARGIN, y - 2, 10, A4[0] - MARGIN * 2, 0.45);
    if (block.finding.level !== "none") {
      y = drawWrapped(
        page, font, block.finding.explanation, MARGIN, y - 2, 9, A4[0] - MARGIN * 2, 0.35,
      );
    }
    y -= 12;
  }

  // --- Signature + audit page ---
  const sigPage = doc.addPage(A4);
  let sy = A4[1] - MARGIN;
  sy = drawText(sigPage, font, "Signature", MARGIN, sy, 16);
  sy -= 12;

  if (input.signaturePng) {
    const sig = await doc.embedPng(input.signaturePng);
    const sw = Math.min(220, sig.width);
    const sh = (sig.height / sig.width) * sw;
    sigPage.drawImage(sig, { x: MARGIN, y: sy - sh, width: sw, height: sh });
    sy -= sh + 10;
  } else {
    sy = drawText(sigPage, font, "(unsigned review copy)", MARGIN, sy, 11, 0.5);
    sy -= 6;
  }

  const signedAt = input.signedAtIso ?? new Date().toISOString();
  const auditLines = [
    `Signer: ${input.signerName}`,
    `Signed at: ${signedAt}`,
    `Document SHA-256: ${input.documentHash}`,
    `Clauses reviewed: ${input.blocks.length}`,
    `High risk: ${count(input.blocks, "high")}  ·  Medium: ${count(input.blocks, "medium")}  ·  Low: ${count(input.blocks, "low")}`,
    "Processed fully on-device by LinguaSign Mobile (OCR, translation, risk analysis).",
  ];
  for (const line of auditLines) {
    sy = drawText(sigPage, font, line, MARGIN, sy, 10, 0.35);
  }

  return doc.save();
}

function count(blocks: ProcessedBlock[], level: string): number {
  return blocks.filter((b) => b.finding.level === level).length;
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  gray = 0,
): number {
  page.drawText(text, { x, y: y - size, size, font, color: rgb(gray, gray, gray) });
  return y - size - 6;
}

/** Simple greedy word-wrap using real font metrics. Returns the new y. */
function drawWrapped(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  gray = 0.1,
): number {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      y = drawText(page, font, line, x, y, size, gray);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) y = drawText(page, font, line, x, y, size, gray);
  return y;
}
