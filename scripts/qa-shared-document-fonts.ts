// Real acquired-font loading/embedding control; no font or PDF bytes are published.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { georgiaBold } from "../lib/certificate-pdf";

async function main() {
  const directory = process.env.REPORT_CARD_FONT_DIR;
  if (!directory || !path.isAbsolute(directory)) throw new Error("FONT_DIRECTORY_REQUIRED");
  const school = georgiaBold(); // Actual certificate loader including embedding-rights checks.
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const page = document.addPage([595.28, 841.89]);
  for (const [filename, family, style] of [
    ["Arial.ttf", "Arial", "Regular"], ["Arial_Bold.ttf", "Arial", "Bold"],
    ["Georgia_Bold.ttf", "Georgia", "Bold"]
  ] as const) {
    const bytes = readFileSync(path.join(directory, filename));
    const face = (fontkit as any).create(bytes);
    if (face.familyName !== family || face.subfamilyName !== style ||
        !face.hasGlyphForCodePoint(65)) throw new Error("DOCUMENT_FONT_IDENTITY_REFUSED");
    if (filename === "Georgia_Bold.ttf" && !bytes.equals(school.bytes)) throw new Error("CERTIFICATE_REPORT_FONT_MISMATCH");
    const embedded = await document.embedFont(bytes, { subset: false });
    page.drawText("SYNTHETIC FONT CONTROL", { font: embedded, x: 40, y: 700 - document.getPageCount() * 10, size: 12 });
    console.log(JSON.stringify({ phase: "application_font_loaded", filename, family, style,
      sha256: createHash("sha256").update(bytes).digest("hex") }));
  }
  const bytes = await document.save();
  const loaded = await PDFDocument.load(bytes);
  if (loaded.getPageCount() !== 1 || loaded.getPage(0).getWidth() !== 595.28 ||
      loaded.getPage(0).getHeight() !== 841.89) throw new Error("FONT_EMBEDDING_CONTROL_FAILED");
  console.log(JSON.stringify({ phase: "application_pdf_embedding", fonts: 3, pages: 1, bytes: bytes.length, outcome: "passed" }));
}
void main().catch(() => { console.error("SHARED_DOCUMENT_FONT_APPLICATION_CONTROL_FAILED"); process.exitCode = 1; });
