/**
 * Node e2e for the PDF export — generates a signed review PDF from sample
 * pipeline output using the exact code the app ships.
 *
 * Run: npx tsx engine/__tests__/pdf.e2e.ts <NotoSansKR.otf> <out.pdf>
 */

import { readFileSync, writeFileSync } from "node:fs";

import { exportSignedPdf } from "../pdf/export";
import { ProcessedBlock } from "../pipeline";

const [fontPath, outPath] = process.argv.slice(2);
if (!fontPath || !outPath) {
  console.error("usage: tsx pdf.e2e.ts <font.otf> <out.pdf>");
  process.exit(2);
}

const blocks: ProcessedBlock[] = [
  {
    id: "b1",
    text: "본 계약은 자동갱신되며 해지 통보는 30일 전에 하여야 한다.",
    bbox: null,
    translation: "The contract is automatically renewed and notice must be given 30 days in advance.",
    finding: {
      level: "high",
      type: "AUTO_RENEWAL",
      explanation:
        "This contract renews by itself unless you actively cancel it before the deadline — missing the window locks you in for another term.",
      source: "rules",
    },
  },
  {
    id: "b2",
    text: "위약금은 월 임대료의 3배로 한다.",
    bbox: null,
    translation: "The penalty is three times the monthly rent.",
    finding: {
      level: "high",
      type: "PENALTY",
      explanation:
        "You can be charged an extra fee or lose money if you break or leave this agreement — check the exact amount before signing.",
      source: "rules",
    },
  },
  {
    id: "b3",
    text: "준거법은 대한민국법을 따른다.",
    bbox: null,
    translation: "The governing law is the law of the Republic of Korea.",
    finding: {
      level: "low",
      type: "GOVERNING_LAW",
      explanation:
        "This picks which country's or region's law applies and where disputes are handled — it may be far from where you live.",
      source: "classifier",
    },
  },
];

async function main() {
  const pdf = await exportSignedPdf({
    pageImages: [],
    blocks,
    fontBytes: readFileSync(fontPath),
    signerName: "Hong Gildong",
    documentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    signedAtIso: new Date().toISOString(),
  });
  writeFileSync(outPath, pdf);
  console.log(`wrote ${outPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
