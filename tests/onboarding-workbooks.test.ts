import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { strToU8, unzipSync, zipSync } from "fflate";
import { generateOnboardingTemplate, parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";

const decoder = new TextDecoder();

function combinedTemplate() {
  return generateOnboardingTemplate({
    bundle: "COMBINED",
    generatedAt: new Date("2026-08-10T12:00:00.000Z"),
    academicYears: ["2026-27"],
    classes: [{ academicYear: "2026-27", className: "I", section: "A" }],
    departments: ["Academics"],
    designations: ["Teacher"]
  });
}

describe("governed onboarding workbooks", () => {
  it("generates a macro-free, protected and validated combined template", () => {
    const bytes = combinedTemplate();
    const files = unzipSync(bytes);
    const workbook = XLSX.read(bytes, { type: "buffer", cellStyles: true });
    const studentXml = decoder.decode(files["xl/worksheets/sheet5.xml"]);
    const instructionXml = decoder.decode(files["xl/worksheets/sheet1.xml"]);
    const contentTypes = decoder.decode(files["[Content_Types].xml"]);
    const styles = decoder.decode(files["xl/styles.xml"]);
    const parsed = parseOnboardingWorkbook(bytes, "COMBINED");

    expect(workbook.SheetNames).toEqual([
      "Instructions", "Template Metadata", "Academic Years", "Classes and Sections",
      "Students", "Guardians", "Student-Guardian Links", "Enrollments", "Staff",
      "Code Lists", "Validation Summary", "Import Batch Reference"
    ]);
    expect(workbook.Sheets.Instructions.A1.v).toBe("NALANDA PUBLIC SCHOOL");
    expect(styles).toContain("Georgia");
    expect(instructionXml).toContain("sheetProtection");
    expect(studentXml.match(/<dataValidation /g)?.length).toBe(5);
    expect(contentTypes).not.toContain('Extension="bin"');
    expect(Object.keys(files).some((name) => name.toLowerCase().includes("vba"))).toBe(false);
    expect(parsed.students).toEqual([]);
    expect(parsed.staff).toEqual([]);
  });

  it("keeps the Staff sheet out of the Student and Guardian bundle", () => {
    const bytes = generateOnboardingTemplate({ bundle: "STUDENT_GUARDIAN" });
    const workbook = XLSX.read(bytes, { type: "buffer" });
    expect(workbook.SheetNames).not.toContain("Staff");
    expect(parseOnboardingWorkbook(bytes, "STUDENT_GUARDIAN").staff).toEqual([]);
  });

  it("rejects formulas and formula-injection text in user-entry cells", () => {
    const workbook = XLSX.read(combinedTemplate(), { type: "buffer" });
    workbook.Sheets.Students.C2 = { t: "n", v: 2, f: "1+1" };
    const formulaBytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    expect(() => parseOnboardingWorkbook(formulaBytes, "COMBINED")).toThrow(/FORMULA_CELL_REFUSED/);

    const second = XLSX.read(combinedTemplate(), { type: "buffer" });
    second.Sheets.Guardians.B2 = { t: "s", v: "=HYPERLINK(\"https://invalid.example\")" };
    const injectedBytes = Buffer.from(XLSX.write(second, { type: "buffer", bookType: "xlsx" }));
    expect(() => parseOnboardingWorkbook(injectedBytes, "COMBINED")).toThrow(/FORMULA_INJECTION_REFUSED/);
  });

  it("rejects external OOXML relationships", () => {
    const files = unzipSync(combinedTemplate());
    const key = "xl/_rels/workbook.xml.rels";
    const malicious = decoder.decode(files[key]).replace(
      "</Relationships>",
      '<Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://invalid.example" TargetMode="External"/></Relationships>'
    );
    files[key] = strToU8(malicious);
    expect(() => parseOnboardingWorkbook(zipSync(files), "COMBINED")).toThrow("XLSX_EXTERNAL_LINK_REFUSED");
  });

  it("rejects hidden entry sheets and excessive dimensions", () => {
    const hidden = XLSX.read(combinedTemplate(), { type: "buffer" });
    hidden.Workbook!.Sheets![4].Hidden = 1;
    expect(() => parseOnboardingWorkbook(Buffer.from(XLSX.write(hidden, { type: "buffer", bookType: "xlsx" })), "COMBINED")).toThrow(/HIDDEN_SHEET/);

    const oversized = XLSX.read(combinedTemplate(), { type: "buffer" });
    oversized.Sheets.Students.A5002 = { t: "s", v: "x" };
    oversized.Sheets.Students["!ref"] = "A1:BL5002";
    expect(() => parseOnboardingWorkbook(Buffer.from(XLSX.write(oversized, { type: "buffer", bookType: "xlsx" })), "COMBINED")).toThrow(/TOO_MANY_ROWS|TOO_MANY_COLUMNS/);
  });

  it("rejects executable, encrypted, traversal, malformed and high-expansion containers", () => {
    const cases: Array<[string, (files: Record<string, Uint8Array>) => void, RegExp]> = [
      ["macro", (files) => { files["xl/vbaProject.bin"] = strToU8("synthetic"); }, /EXECUTABLE_OR_EXTERNAL_CONTENT/],
      ["embedded object", (files) => { files["xl/embeddings/object1.bin"] = strToU8("synthetic"); }, /EXECUTABLE_OR_EXTERNAL_CONTENT/],
      ["encrypted", (files) => { files.EncryptionInfo = strToU8("synthetic"); }, /PASSWORD_PROTECTED/],
      ["traversal", (files) => { files["../synthetic.xml"] = strToU8("synthetic"); }, /TRAVERSAL/]
    ];
    for (const [, mutate, expected] of cases) {
      const files = unzipSync(combinedTemplate());
      mutate(files);
      expect(() => parseOnboardingWorkbook(zipSync(files), "COMBINED")).toThrow(expected);
    }
    expect(() => parseOnboardingWorkbook(Buffer.from("MZ synthetic executable"), "COMBINED")).toThrow(/SIGNATURE/);
    expect(() => parseOnboardingWorkbook(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), "COMBINED")).toThrow(/ENTRY_COUNT/);
    const bomb = unzipSync(combinedTemplate());
    bomb["xl/synthetic-high-expansion.xml"] = new Uint8Array(2 * 1024 * 1024);
    expect(() => parseOnboardingWorkbook(zipSync(bomb, { level: 9 }), "COMBINED")).toThrow(/ZIP_BOMB|EXPANSION/);
  });

  it("keeps extension, MIME, size, residue and symlink controls at the upload boundary", () => {
    const route = readFileSync("app/api/onboarding/batches/route.ts", "utf8");
    const storage = readFileSync("lib/onboarding-storage.ts", "utf8");
    expect(route).toContain('endsWith(".xlsx")');
    expect(route).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(route).toContain("MAX_ONBOARDING_WORKBOOK_BYTES");
    expect(route.indexOf("parseOnboardingWorkbook(bytes, bundle)")).toBeLessThan(route.indexOf("storeOnboardingWorkbook(bytes)"));
    expect(route).toContain("if (storageKey) await removeOnboardingWorkbook(storageKey)");
    expect(storage).toContain("isSymbolicLink()");
    expect(storage).toContain("PRIVATE_STORAGE_KEY_INVALID");
    expect(storage).toContain('open(target, "wx", 0o600)');
  });
});
