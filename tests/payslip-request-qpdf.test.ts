import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument, PDFHexString, PDFName, StandardFonts, rgb } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PdfProtectionAdapter, validatePayslipPdf } from "@/lib/payslip-request-pdf";
import { generateDocumentPassword, generateOwnerPassword } from "@/lib/payslip-request-crypto";

const executable = process.env.QPDF_EXECUTABLE_PATH;
const enabled = Boolean(executable);
let root = "";

beforeAll(async () => { if (enabled) root = await mkdtemp(path.join(os.tmpdir(), "payslipreq1-qpdf-")); });
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe.skipIf(!enabled)("HR-PAYSLIP-REQ-1 reviewed qpdf adapter", () => {
  it("rejects active actions hidden inside compressed object streams", async () => {
    const document = await PDFDocument.create(); document.addPage([595.28, 841.89]);
    const action = document.context.obj({ S: PDFName.of("JavaScript"), JS: PDFHexString.fromText("app.alert('synthetic')") });
    document.catalog.set(PDFName.of("OpenAction"), document.context.register(action));
    const source = Buffer.from(await document.save({ useObjectStreams: true }));
    expect(source.includes(Buffer.from("/OpenAction"))).toBe(false);
    expect(source.includes(Buffer.from("/JavaScript"))).toBe(false);
    const upload = { name: "compressed-active.pdf", type: "application/pdf", size: source.length, arrayBuffer: async () => Uint8Array.from(source).buffer };
    await expect(validatePayslipPdf(upload)).rejects.toThrow(/scripts|actions/i);
  });

  it("fails closed across malformed, oversized and active-input classes", async () => {
    const safeDocument = await PDFDocument.create(); safeDocument.addPage([595.28, 841.89]);
    const safe = Buffer.from(await safeDocument.save({ useObjectStreams: false }));
    const upload = (bytes: Buffer, name = "synthetic.pdf", type = "application/pdf", size = bytes.length) => ({ name, type, size, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
    await expect(validatePayslipPdf(upload(safe, "../synthetic.pdf"))).rejects.toThrow(/safely named/i);
    await expect(validatePayslipPdf(upload(safe, "synthetic.txt"))).rejects.toThrow(/PDF/i);
    await expect(validatePayslipPdf(upload(safe, "synthetic.pdf", "text/html"))).rejects.toThrow(/MIME/i);
    await expect(validatePayslipPdf(upload(Buffer.from("<html>not a pdf</html>")))).rejects.toThrow(/magic|structure/i);
    await expect(validatePayslipPdf(upload(safe.subarray(0, safe.length - 5)))).rejects.toThrow(/magic|structure/i);
    await expect(validatePayslipPdf(upload(safe, "synthetic.pdf", "application/pdf", 10 * 1024 * 1024 + 1))).rejects.toThrow(/10 MB/i);
    const tooManyPages = await PDFDocument.create(); for (let index = 0; index < 51; index += 1) tooManyPages.addPage([10, 10]);
    await expect(validatePayslipPdf(upload(Buffer.from(await tooManyPages.save({ useObjectStreams: false }))))).rejects.toThrow(/1 to 50 pages/i);

    for (const [name, dictionary] of [
      ["launch", { S: PDFName.of("Launch"), F: PDFHexString.fromText("synthetic.exe") }],
      ["external-uri", { S: PDFName.of("URI"), URI: PDFHexString.fromText("https://invalid.example/") }],
      ["remote-action", { S: PDFName.of("GoToR"), F: PDFHexString.fromText("remote.pdf") }],
      ["embedded-file", { Type: PDFName.of("EmbeddedFile") }],
      ["active-form", { XFA: PDFHexString.fromText("synthetic") }]
    ] as const) {
      const document = await PDFDocument.create(); document.addPage([595.28, 841.89]);
      document.catalog.set(PDFName.of(name === "active-form" ? "AcroForm" : "OpenAction"), document.context.register(document.context.obj(dictionary)));
      const bytes = Buffer.from(await document.save({ useObjectStreams: true }));
      await expect(validatePayslipPdf(upload(bytes)), name).rejects.toThrow(/scripts|attachments|forms|annotations|launch actions|external actions/i);
    }
    const annotated = await PDFDocument.create(), page = annotated.addPage([595.28, 841.89]);
    page.node.set(PDFName.of("Annots"), annotated.context.obj([annotated.context.obj({ Type: PDFName.of("Annot"), Subtype: PDFName.of("Text") })]));
    await expect(validatePayslipPdf(upload(Buffer.from(await annotated.save({ useObjectStreams: true }))))).rejects.toThrow(/annotations/i);
  });

  it("creates an AES-256 protected, print-allowed, editing-restricted derivative with an opening password", async () => {
    const document = await PDFDocument.create(), page = document.addPage([595.28, 841.89]), font = await document.embedFont(StandardFonts.Helvetica);
    page.drawText("Synthetic HR-PAYSLIP-REQ-1 QA document - no salary values", { x: 52, y: 780, size: 12, font, color: rgb(0.1, 0.2, 0.3) });
    const source = Buffer.from(await document.save({ useObjectStreams: false }));
    const upload = { name: "synthetic-payslip.pdf", type: "application/pdf", size: source.length, arrayBuffer: async () => Uint8Array.from(source).buffer };
    const validated = await validatePayslipPdf(upload);
    const openingPassword = generateDocumentPassword(), ownerPassword = generateOwnerPassword();
    expect(openingPassword).toHaveLength(32); expect(ownerPassword).toHaveLength(43);
    const protectedPdf = await new PdfProtectionAdapter().protect(validated, openingPassword, ownerPassword);
    const target = path.join(root, "protected.pdf"); await writeFile(target, protectedPdf.bytes);
    expect(protectedPdf.protection).toBe("AES-256"); expect(protectedPdf.pageCount).toBe(validated.pageCount);
    const correct = await qpdf(["--check", `--password=${openingPassword}`, target]);
    expect(correct.code).toBe(0);
    const wrong = await qpdf(["--check", "--password=definitely-wrong", target]);
    expect(wrong.code).not.toBe(0);
    const encryption = await qpdf(["--show-encryption", `--password=${openingPassword}`, target]);
    expect(encryption.stdout).toMatch(/R\s*=\s*6|AESv3|256-bit/i);
    expect(encryption.stdout).toMatch(/print.*allowed/i);
    expect(encryption.stdout).toMatch(/modify.*not allowed/i);
    expect(encryption.stdout).toMatch(/extract.*not allowed/i);
    expect(encryption.stdout).toMatch(/annotations.*not allowed/i);
    expect(encryption.stdout).toMatch(/form.*not allowed/i);
    expect(Buffer.from(await readFile(target)).includes(Buffer.from(openingPassword))).toBe(false);
    expect(Buffer.from(await readFile(target)).includes(Buffer.from(ownerPassword))).toBe(false);
  });
});

async function qpdf(args: string[]) {
  return new Promise<{ code: number; stdout: string }>((resolve, reject) => {
    const child = spawn(executable!, ["@-"], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout }));
    child.stdin.end(`${args.join("\n")}\n`);
  });
}
