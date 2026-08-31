import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  ONBOARDING_PREPARATION_LIMITS, createSyntheticPackage, dryRunPackage, formulaSafe,
  loadMappingCatalogue, packageDigest, validateManifest, validatePackage,
  validateMappingCatalogue, writeDryRunReports, type PackageManifest
} from "@/lib/onboarding-preparation";

const roots: string[] = [];
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });
async function temp() { const root = await mkdtemp(path.join(os.tmpdir(), "nalanda-onboarding-prep-")); roots.push(root); return root; }
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
async function catalogue() { return loadMappingCatalogue(path.join(process.cwd(), "config", "onboarding", "mapping-catalogue.json")); }
async function rewriteManifest(packageRoot: string, mutate: (manifest: PackageManifest) => void) {
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "manifest.json"), "utf8")) as PackageManifest; mutate(manifest);
  manifest.sha256 = digest([...manifest.files].sort((a, b) => a.fileId.localeCompare(b.fileId) || a.relativePath.localeCompare(b.relativePath)).map((file) => JSON.stringify([file.fileId, file.relativePath, file.format, file.domain, file.declaredEncoding ?? null, file.sizeBytes, file.sha256])).join("\n"));
  manifest.fileSize = manifest.files.reduce((sum, file) => sum + file.sizeBytes, 0); await writeFile(path.join(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

describe("REAL-DATA-ONBOARDING-PREPARATION-1A", () => {
  it("validates the machine-readable mapping catalogue and all required entry fields", async () => {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), "config", "onboarding", "mapping-catalogue.json"), "utf8")); const result = validateMappingCatalogue(raw);
    expect(result.issues).toEqual([]); expect(result.catalogue!.entries.length).toBeGreaterThanOrEqual(70);
    const domains = new Set(result.catalogue!.entries.map((entry) => entry.domain));
    for (const domain of ["STUDENTS", "GUARDIANS", "STAFF", "FINANCE", "ACADEMIC_HISTORY", "DOCUMENTS_MEDIA", "OPTIONAL_OPERATIONAL"]) expect(domains.has(domain)).toBe(true);
    expect(result.catalogue!.entries.some((entry) => entry.proposedTargetService.toLowerCase().includes("prisma"))).toBe(false);
  });

  it("generates deterministic, unmistakably synthetic packages with bounded scale", async () => {
    const first = path.join(await temp(), "one"), second = path.join(await temp(), "two");
    const a = await createSyntheticPackage(first, { students: 120, guardians: 160, staff: 30 }); const b = await createSyntheticPackage(second, { students: 120, guardians: 160, staff: 30 });
    expect(a.counts).toEqual({ students: 120, guardians: 160, staff: 30, files: 9 }); expect(a.manifest.sha256).toBe(b.manifest.sha256);
    expect(await packageDigest(first, a.manifest)).toBe(await packageDigest(second, b.manifest));
    const studentText = await readFile(path.join(first, "students.csv"), "utf8"); expect(studentText).toContain("STUDENT-MIGRATION-0001"); expect(studentText).not.toMatch(/Nalanda Public School|Aadhaar/i);
  });

  it("validates every file checksum, size, containment and package digest", async () => {
    const packageRoot = path.join(await temp(), "package"); await createSyntheticPackage(packageRoot);
    const result = await validatePackage(packageRoot); expect(result.issues).toEqual([]); expect(result.tables).toHaveLength(9); expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(path.join(packageRoot, "students.csv"), "changed"); const changed = await validatePackage(packageRoot);
    expect(changed.issues.map((issue) => issue.code)).toContain("FILE_SIZE_MISMATCH"); expect(changed.issues.map((issue) => issue.code)).toContain("PACKAGE_DIGEST_MISMATCH");
  });

  it("binds mapping-sensitive metadata into the digest and rejects undeclared package entries", async () => {
    const packageRoot = path.join(await temp(), "package"); await createSyntheticPackage(packageRoot);
    const manifestPath = path.join(packageRoot, "manifest.json"); const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest;
    manifest.files[0].domain = "STAFF"; await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    expect((await validatePackage(packageRoot)).issues.map((issue) => issue.code)).toContain("PACKAGE_DIGEST_MISMATCH");
    await rewriteManifest(packageRoot, () => undefined); await writeFile(path.join(packageRoot, "undeclared.csv"), "untrusted,content\n");
    expect((await validatePackage(packageRoot)).issues.map((issue) => issue.code)).toContain("UNDECLARED_OR_NON_REGULAR_PACKAGE_ENTRY");
  });

  it("enforces CSV resource limits during parsing", async () => {
    const packageRoot = path.join(await temp(), "bounded"); await createSyntheticPackage(packageRoot); const file = path.join(packageRoot, "students.csv");
    const excessive = `source_student_id,student_name\n${Array.from({ length: ONBOARDING_PREPARATION_LIMITS.maxRowsPerSheet + 1 }, (_, index) => `SYN-LIMIT-${index},STUDENT-LIMIT-${index}`).join("\n")}\n`;
    await writeFile(file, excessive); await rewriteManifest(packageRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "STUDENTS")!; entry.sha256 = digest(excessive); entry.sizeBytes = Buffer.byteLength(excessive); });
    const result = await validatePackage(packageRoot); expect(result.issues.map((issue) => issue.code)).toContain("ROW_LIMIT_EXCEEDED"); expect(result.tables.some((table) => table.fileId === "STUDENTS")).toBe(false);
  });

  it("performs a deterministic no-write dry run and emits all fixed reports", async () => {
    const root = await temp(), packageRoot = path.join(root, "package"), reportRoot = path.join(root, "reports"); await createSyntheticPackage(packageRoot);
    const before = (await validatePackage(packageRoot)).digest; const first = await dryRunPackage(packageRoot, await catalogue()); const second = await dryRunPackage(packageRoot, await catalogue());
    expect(first).toEqual(second); expect(first.noWriteProof).toEqual({ authoritativeWriteCount: 0, databaseAccess: false, networkAccess: false, sourceMutation: false }); expect(first.packageDigest).toBe(before); expect(first.sourceDigestAfter).toBe(before); expect(first.rowsReceived).toBeGreaterThan(300); expect(first.proposed.updates).toBe(0);
    await writeDryRunReports(reportRoot, first); const names = ["PACKAGE_VALIDATION.json", "FIELD_MAPPING_REPORT.csv", "ROW_ERROR_REPORT.csv", "DUPLICATE_CANDIDATES.csv", "REFERENCE_ERRORS.csv", "FINANCIAL_RECONCILIATION.csv", "IMPORT_WAVE_SUMMARY.json", "APPROVAL_CHECKLIST.md"];
    for (const name of names) expect((await readFile(path.join(reportRoot, name))).length).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(path.join(reportRoot, "IMPORT_WAVE_SUMMARY.json"), "utf8"))).toMatchObject({ actualImports: 0, readyForPrivateStagingImport: false });
    if (process.platform !== "win32") { expect((await stat(reportRoot)).mode & 0o777).toBe(0o700); for (const name of names) expect((await stat(path.join(reportRoot, name))).mode & 0o777).toBe(0o600); }
  });

  it("classifies adversarial formulas and exact identifiers without silently repairing them", async () => {
    const packageRoot = path.join(await temp(), "adversarial"); await createSyntheticPackage(packageRoot, { adversarial: true }); const result = await dryRunPackage(packageRoot, await catalogue()); const codes = result.issues.map((issue) => issue.code);
    for (const code of ["CSV_FORMULA_REFUSED", "EXACT_IDENTIFIER_DUPLICATE", "DECLARED_DATE_INVALID", "GUARDIAN_REFERENCE_UNRESOLVED", "CLASS_SECTION_REFERENCE_UNRESOLVED", "STUDENT_REFERENCE_UNRESOLVED", "UNEXPLAINED_FINANCIAL_DIFFERENCE", "SUPPORTING_CONTACT_DUPLICATE", "CELL_LENGTH_LIMIT_EXCEEDED", "SCIENTIFIC_NOTATION_IDENTIFIER"]) expect(codes).toContain(code);
    expect(result.duplicates[0]).toMatchObject({ domain: "STUDENTS", signals: ["source_student_id"] }); expect(result.sensitiveFields).toContain("aadhaar"); expect(result.validationState).toBe("INVALID_FORMAT");
  });

  it("parses quoted commas and embedded newlines without changing leading-zero identifiers", async () => {
    const packageRoot = path.join(await temp(), "quoted"); await createSyntheticPackage(packageRoot); const file = path.join(packageRoot, "guardians.csv"); const text = await readFile(file, "utf8");
    const changed = text.replace("\"GUARDIAN-MIGRATION-0001\"", "\"GUARDIAN,\r\nMIGRATION-0001\""); await writeFile(file, changed);
    await rewriteManifest(packageRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "GUARDIANS")!; entry.sha256 = digest(changed); entry.sizeBytes = Buffer.byteLength(changed); });
    const result = await validatePackage(packageRoot); expect(result.issues).toEqual([]); const guardians = result.tables.find((table) => table.fileId === "GUARDIANS")!; expect(guardians.rows[0][1]).toBe("GUARDIAN,\r\nMIGRATION-0001");
    expect(result.tables.find((table) => table.fileId === "STUDENTS")!.rows[0][1]).toBe("SYN-ADM-0001");
  });

  it("rejects malicious paths, unsupported formats, excessive sizes and weak identifiers at the manifest boundary", async () => {
    const packageRoot = path.join(await temp(), "package"); const generated = await createSyntheticPackage(packageRoot); const base = generated.manifest;
    for (const mutate of [
      (manifest: PackageManifest) => { manifest.files[0].relativePath = "../students.csv"; },
      (manifest: PackageManifest) => { manifest.files[0].relativePath = "students.xlsm"; manifest.files[0].format = "XLSX"; },
      (manifest: PackageManifest) => { manifest.files[0].sizeBytes = ONBOARDING_PREPARATION_LIMITS.maxFileBytes + 1; },
      (manifest: PackageManifest) => { manifest.packageId = "x"; },
      (manifest: PackageManifest) => { manifest.files.push(structuredClone(manifest.files[0])); }
    ]) { const copy = structuredClone(base); mutate(copy); expect(validateManifest(copy).issues.length).toBeGreaterThan(0); }
  });

  it("reports missing manifests and declared files without an unhandled package read", async () => {
    const missingManifest = path.join(await temp(), "missing-manifest"); await createSyntheticPackage(missingManifest); await rm(path.join(missingManifest, "manifest.json"));
    expect((await validatePackage(missingManifest)).issues.map((issue) => issue.code)).toContain("MANIFEST_FILE_MISSING");
    const missingFile = path.join(await temp(), "missing-file"); await createSyntheticPackage(missingFile); await rm(path.join(missingFile, "students.csv"));
    const result = await validatePackage(missingFile); expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["PACKAGE_FILE_MISSING", "PACKAGE_DIGEST_UNAVAILABLE"]));
  });

  it("rejects duplicate and blank headings, malformed quotes, excessive columns and unknown fields", async () => {
    const headerRoot = path.join(await temp(), "headers"); await createSyntheticPackage(headerRoot); const headerFile = path.join(headerRoot, "students.csv");
    const headers = "source_student_id,source_student_id,,unknown_field\nSYN-STU-HEADER,SYN-STU-SECOND,value,unknown\n"; await writeFile(headerFile, headers);
    await rewriteManifest(headerRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "STUDENTS")!; entry.sha256 = digest(headers); entry.sizeBytes = Buffer.byteLength(headers); });
    const headerResult = await dryRunPackage(headerRoot, await catalogue()); expect(headerResult.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DUPLICATE_HEADER", "BLANK_HEADER", "UNMAPPED_HEADER"]));

    const columnsRoot = path.join(await temp(), "columns"); await createSyntheticPackage(columnsRoot); const columnsFile = path.join(columnsRoot, "students.csv"); const columns = `${Array.from({ length: ONBOARDING_PREPARATION_LIMITS.maxColumns + 1 }, (_, index) => `field_${index}`).join(",")}\n${Array.from({ length: ONBOARDING_PREPARATION_LIMITS.maxColumns + 1 }, () => "x").join(",")}\n`; await writeFile(columnsFile, columns);
    await rewriteManifest(columnsRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "STUDENTS")!; entry.sha256 = digest(columns); entry.sizeBytes = Buffer.byteLength(columns); });
    expect((await validatePackage(columnsRoot)).issues.map((issue) => issue.code)).toContain("COLUMN_LIMIT_EXCEEDED");

    const malformedRoot = path.join(await temp(), "malformed"); await createSyntheticPackage(malformedRoot); const malformedFile = path.join(malformedRoot, "students.csv"); const malformed = 'source_student_id,student_name\n"SYN-STU-OPEN,Unclosed\n'; await writeFile(malformedFile, malformed);
    await rewriteManifest(malformedRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "STUDENTS")!; entry.sha256 = digest(malformed); entry.sizeBytes = Buffer.byteLength(malformed); });
    expect((await validatePackage(malformedRoot)).issues.map((issue) => issue.code)).toContain("CSV_UNCLOSED_QUOTE");
  });

  it("blocks a missing required mapped value rather than synthesising it", async () => {
    const packageRoot = path.join(await temp(), "missing-required"); await createSyntheticPackage(packageRoot); const file = path.join(packageRoot, "students.csv"); const text = await readFile(file, "utf8"); const changed = text.replace('"SYN-STU-0001"', '""'); await writeFile(file, changed);
    await rewriteManifest(packageRoot, (manifest) => { const entry = manifest.files.find((item) => item.fileId === "STUDENTS")!; entry.sha256 = digest(changed); entry.sizeBytes = Buffer.byteLength(changed); });
    expect((await dryRunPackage(packageRoot, await catalogue())).issues.map((issue) => issue.code)).toContain("REQUIRED_VALUE_MISSING");
  });

  it("reports low-confidence encoding instead of guessing", async () => {
    const packageRoot = path.join(await temp(), "encoding"); await createSyntheticPackage(packageRoot); const bytes = Buffer.from([0xff, 0xfe, 0xfd, 0x2c, 0x61]); await writeFile(path.join(packageRoot, "students.csv"), bytes);
    await rewriteManifest(packageRoot, (manifest) => { const file = manifest.files.find((item) => item.fileId === "STUDENTS")!; file.sha256 = digest(bytes); file.sizeBytes = bytes.length; file.declaredEncoding = "UNKNOWN"; });
    const result = await validatePackage(packageRoot); expect(result.issues.map((issue) => issue.code)).toContain("ENCODING_LOW_CONFIDENCE");
  });

  it("supports safe XLSX but rejects formulas, hidden sheets and merged cells", async () => {
    const packageRoot = path.join(await temp(), "xlsx"); await createSyntheticPackage(packageRoot); const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([["source_student_id", "student_name"], ["SYN-STU-XLSX", "STUDENT-MIGRATION-XLSX"]]); XLSX.utils.book_append_sheet(workbook, sheet, "Students"); const bytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })); await writeFile(path.join(packageRoot, "students.xlsx"), bytes); await rm(path.join(packageRoot, "students.csv"));
    await rewriteManifest(packageRoot, (manifest) => { const file = manifest.files.find((item) => item.fileId === "STUDENTS")!; file.relativePath = "students.xlsx"; file.format = "XLSX"; file.sha256 = digest(bytes); file.sizeBytes = bytes.length; delete file.declaredEncoding; });
    expect((await validatePackage(packageRoot)).issues).toEqual([]);
    sheet.B2 = { t: "n", f: "1+1", v: 2 }; const formulaBytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })); await writeFile(path.join(packageRoot, "students.xlsx"), formulaBytes); await rewriteManifest(packageRoot, (manifest) => { const file = manifest.files.find((item) => item.fileId === "STUDENTS")!; file.sha256 = digest(formulaBytes); file.sizeBytes = formulaBytes.length; });
    expect((await validatePackage(packageRoot)).issues.map((issue) => issue.code)).toContain("FORMULA_CELL_REFUSED");
    delete sheet.B2.f; workbook.Workbook = { Sheets: [{ Hidden: 1 }] }; const hiddenBytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })); await writeFile(path.join(packageRoot, "students.xlsx"), hiddenBytes); await rewriteManifest(packageRoot, (manifest) => { const file = manifest.files.find((item) => item.fileId === "STUDENTS")!; file.sha256 = digest(hiddenBytes); file.sizeBytes = hiddenBytes.length; });
    expect((await validatePackage(packageRoot)).issues.map((issue) => issue.code)).toContain("HIDDEN_SHEET_REFUSED");
    workbook.Workbook = { Sheets: [{ Hidden: 0 }] }; sheet["!merges"] = [XLSX.utils.decode_range("A1:B1")]; const mergedBytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })); await writeFile(path.join(packageRoot, "students.xlsx"), mergedBytes); await rewriteManifest(packageRoot, (manifest) => { const file = manifest.files.find((item) => item.fileId === "STUDENTS")!; file.sha256 = digest(mergedBytes); file.sizeBytes = mergedBytes.length; });
    expect((await validatePackage(packageRoot)).issues.map((issue) => issue.code)).toContain("MERGED_CELLS_REFUSED");
  });

  it("neutralises every spreadsheet formula prefix in report output", () => {
    for (const value of ["=cmd", "+SUM(1)", "-1+1", "@formula", " \t=cmd"]) expect(formulaSafe(value).startsWith("'")).toBe(true);
    expect(formulaSafe("ordinary value")).toBe("ordinary value");
  });

  it("keeps the preparation engine provider-independent and outside Prisma/runtime imports", async () => {
    const source = await readFile(path.join(process.cwd(), "lib", "onboarding-preparation.ts"), "utf8");
    expect(source).not.toMatch(/@prisma\/client|DATABASE_URL|\bfetch\s*\(|child_process/); expect(source).toContain("authoritativeWriteCount: 0");
    for (const schema of ["source-inventory.schema.json", "package-manifest.schema.json", "mapping-catalogue.schema.json", "import-waves.json", "limits.json"]) expect(() => JSON.parse(require("node:fs").readFileSync(path.join(process.cwd(), "config", "onboarding", schema), "utf8"))).not.toThrow();
  });
});
