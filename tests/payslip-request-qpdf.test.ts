import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PdfProtectionAdapter, validatePayslipPdf } from "@/lib/payslip-request-pdf";
import { generateDocumentPassword, generateOwnerPassword } from "@/lib/payslip-request-crypto";

const executable = process.env.QPDF_EXECUTABLE_PATH;
const enabled = Boolean(executable);
let root = "";

beforeAll(async () => { if (enabled) root = await mkdtemp(path.join(os.tmpdir(), "payslipreq1-qpdf-")); });
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe.skipIf(!enabled)("HR-PAYSLIP-REQ-1 reviewed qpdf adapter", () => {
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
