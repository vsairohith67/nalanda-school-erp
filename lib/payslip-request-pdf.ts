import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PDFDocument } from "pdf-lib";

export const PAYSLIP_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYSLIP_PDF_MAX_PAGES = 50;
const QPDF_TIMEOUT_MS = 20_000;
const QPDF_OUTPUT_LIMIT = 16 * 1024;

export class PayslipPdfError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "PAYSLIP_PDF_INVALID") {
    super(message);
  }
}

export type ValidatedPayslipPdf = {
  bytes: Buffer;
  byteSize: number;
  pageCount: number;
  sha256: string;
};

export type ProtectedPayslipPdf = {
  bytes: Buffer;
  byteSize: number;
  pageCount: number;
  sha256: string;
  protection: "AES-256";
};

export async function validatePayslipPdf(file: Pick<File, "name" | "type" | "size" | "arrayBuffer">): Promise<ValidatedPayslipPdf> {
  if (!file || typeof file.name !== "string" || !file.name.trim()) throw new PayslipPdfError("Choose a PDF file.");
  if (/[/\\\u0000]/.test(file.name) || file.name === "." || file.name === ".." || path.extname(file.name).toLowerCase() !== ".pdf") {
    throw new PayslipPdfError("Only a safely named PDF file is accepted.");
  }
  if (file.type.toLowerCase() !== "application/pdf") throw new PayslipPdfError("The PDF extension and MIME type do not match.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > PAYSLIP_PDF_MAX_BYTES) throw new PayslipPdfError("PDF files must be between 1 byte and 10 MB.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > PAYSLIP_PDF_MAX_BYTES) throw new PayslipPdfError("The uploaded PDF is truncated or exceeds the size limit.");
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !/%%EOF[\s\u0000]*$/.test(bytes.toString("latin1"))) {
    throw new PayslipPdfError("The PDF magic or end structure is invalid.");
  }
  rejectUnsafePdfObjects(bytes);
  let pageCount = 0;
  try {
    const document = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true });
    pageCount = document.getPageCount();
  } catch {
    throw new PayslipPdfError("The PDF is encrypted, malformed, truncated, or unsupported.");
  }
  if (pageCount < 1 || pageCount > PAYSLIP_PDF_MAX_PAGES) throw new PayslipPdfError("PDF files must contain 1 to 50 pages.");
  await qpdfCheck(bytes);
  return { bytes, byteSize: bytes.length, pageCount, sha256: sha256(bytes) };
}

export class PdfProtectionAdapter {
  async protect(input: ValidatedPayslipPdf, openingPassword: string, ownerPassword: string): Promise<ProtectedPayslipPdf> {
    if (!/^[A-Za-z0-9_-]{32}$/.test(openingPassword) || !/^[A-Za-z0-9_-]{43}$/.test(ownerPassword) || openingPassword === ownerPassword) {
      throw new PayslipPdfError("Strong independent PDF passwords are required.", 500, "PDF_PASSWORD_INVALID");
    }
    const executable = await validatedQpdfExecutable();
    const temporary = await protectedTemporaryDirectory();
    const source = path.join(temporary, "source.pdf");
    const derivative = path.join(temporary, "protected.pdf");
    try {
      await writeFile(source, input.bytes, { flag: "wx", mode: 0o600 });
      await runQpdf(executable, [
        source,
        derivative,
        "--warning-exit-0",
        "--object-streams=generate",
        "--encrypt",
        `--user-password=${openingPassword}`,
        `--owner-password=${ownerPassword}`,
        "--bits=256",
        "--print=full",
        "--modify=none",
        "--extract=n",
        "--annotate=n",
        "--form=n",
        "--assemble=n",
        "--"
      ]);
      const bytes = await readFile(derivative);
      if (bytes.length < 1 || bytes.length > PAYSLIP_PDF_MAX_BYTES + 2 * 1024 * 1024) throw new PayslipPdfError("The protected PDF has an invalid size.", 500, "PDF_PROTECTION_FAILED");
      const inspection = await runQpdf(executable, ["--show-encryption", `--password=${openingPassword}`, derivative]);
      if (!/(R\s*=\s*6|AESv3|256-bit)/i.test(inspection.stdout) || !/print.*allowed/i.test(inspection.stdout) || !/(modify|modify document).*not allowed/i.test(inspection.stdout)) {
        throw new PayslipPdfError("The protected PDF did not prove the required AES-256 permissions.", 500, "PDF_PROTECTION_UNVERIFIED");
      }
      const pages = await runQpdf(executable, ["--show-npages", `--password=${openingPassword}`, derivative]);
      const pageCount = Number(pages.stdout.trim());
      if (pageCount !== input.pageCount) throw new PayslipPdfError("The protected PDF page count changed.", 500, "PDF_CONTENT_CHANGED");
      const passwordRequirement = await runQpdf(executable, ["--requires-password", derivative], [0, 2]);
      if (passwordRequirement.code !== 0) throw new PayslipPdfError("The protected PDF can be opened without a password.", 500, "PDF_PASSWORD_NOT_REQUIRED");
      return { bytes, byteSize: bytes.length, pageCount, sha256: sha256(bytes), protection: "AES-256" };
    } finally {
      await removeProtectedTemporaryDirectory(temporary);
    }
  }
}

async function qpdfCheck(bytes: Buffer) {
  const executable = await validatedQpdfExecutable();
  const temporary = await protectedTemporaryDirectory();
  const source = path.join(temporary, "intake.pdf");
  try {
    await writeFile(source, bytes, { flag: "wx", mode: 0o600 });
    await runQpdf(executable, ["--check", source]);
  } finally {
    await removeProtectedTemporaryDirectory(temporary);
  }
}

function rejectUnsafePdfObjects(bytes: Buffer) {
  const text = bytes.toString("latin1");
  const unsafe = /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|EmbeddedFiles|Filespec|RichMedia|XFA|AcroForm|SubmitForm|ImportData|GoToR|URI)\b/i;
  if (unsafe.test(text)) throw new PayslipPdfError("PDFs with scripts, attachments, forms, annotations, launch actions, or external actions are not accepted.");
  if (/\/Annots\b(?!\s*\[\s*\])/i.test(text)) throw new PayslipPdfError("PDFs with active annotations are not accepted.");
  if (/\/Encrypt\b/i.test(text)) throw new PayslipPdfError("Pre-encrypted PDFs require a separately governed import path.");
}

async function validatedQpdfExecutable() {
  const configured = process.env.QPDF_EXECUTABLE_PATH?.trim();
  if (!configured || !path.isAbsolute(configured)) throw new PayslipPdfError("The reviewed PDF protection utility is unavailable.", 503, "PDF_PROTECTION_UNAVAILABLE");
  const resolved = path.resolve(configured);
  const stat = await lstat(resolved).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new PayslipPdfError("The reviewed PDF protection utility is unavailable.", 503, "PDF_PROTECTION_UNAVAILABLE");
  await assertNoSymlinkPath(path.dirname(resolved));
  const version = await runQpdf(resolved, ["--version"]);
  const match = /qpdf version (\d+)\.(\d+)\.(\d+)/i.exec(version.stdout);
  if (!match || Number(match[1]) < 11 || Number(match[1]) === 11 && Number(match[2]) < 7) {
    throw new PayslipPdfError("qpdf 11.7 or newer is required for reviewed AES-256 protection.", 503, "PDF_PROTECTION_UNAVAILABLE");
  }
  return resolved;
}

async function protectedTemporaryDirectory() {
  const root = path.resolve(process.env.PAYSLIP_REQUEST_TEMP_ROOT?.trim() || path.join(process.cwd(), "tmp", "payslip-request-processing"));
  await mkdir(root, { recursive: true, mode: 0o700 });
  await assertNoSymlinkPath(root);
  const target = path.join(root, randomUUID());
  await mkdir(target, { mode: 0o700 });
  return target;
}

async function removeProtectedTemporaryDirectory(target: string) {
  const root = path.resolve(process.env.PAYSLIP_REQUEST_TEMP_ROOT?.trim() || path.join(process.cwd(), "tmp", "payslip-request-processing"));
  const resolved = path.resolve(target);
  if (!resolved.startsWith(`${root}${path.sep}`) || resolved === root) throw new PayslipPdfError("The protected PDF temporary path is invalid.", 500);
  await rm(resolved, { recursive: true, force: true });
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  const relative = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of relative) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(() => null);
    if (stat?.isSymbolicLink()) throw new PayslipPdfError("PDF processing paths may not contain symlinks.", 500);
  }
  await realpath(target).catch(() => null);
}

async function runQpdf(executable: string, argumentsViaStdin: string[], acceptedCodes = [0]) {
  if (argumentsViaStdin.some((value) => /[\r\n\u0000]/.test(value))) throw new PayslipPdfError("The PDF utility arguments are invalid.", 500);
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(executable, ["@-"], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new PayslipPdfError("PDF protection exceeded the bounded processing time.", 503, "PDF_PROTECTION_TIMEOUT"));
    }, QPDF_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < QPDF_OUTPUT_LIMIT) stdout += chunk.toString("utf8", 0, QPDF_OUTPUT_LIMIT - stdout.length); });
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < QPDF_OUTPUT_LIMIT) stderr += chunk.toString("utf8", 0, QPDF_OUTPUT_LIMIT - stderr.length); });
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new PayslipPdfError("The reviewed PDF protection utility could not start.", 503, "PDF_PROTECTION_UNAVAILABLE"));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const numericCode = code ?? -1;
      if (!acceptedCodes.includes(numericCode)) {
        reject(new PayslipPdfError("The reviewed PDF protection utility rejected the document.", 400, "PDF_PROTECTION_REJECTED"));
      } else resolve({ stdout, stderr, code: numericCode });
    });
    child.stdin.end(`${argumentsViaStdin.join("\n")}\n`);
  });
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
