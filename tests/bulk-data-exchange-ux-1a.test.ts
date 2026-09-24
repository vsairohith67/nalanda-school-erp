import { canonicalOnboardingPackage } from "../lib/onboarding-canonical-package";
import { unzipSync } from "fflate";
import { buildControlledSourcePackage } from "../lib/onboarding-source-package";
import { parseOnboardingWorkbook } from "../lib/onboarding-workbooks";
import { projectMarksCsv } from "../lib/marks-import-csv";
import { describe, it, expect, vi } from "vitest";
import { projectStudentRows, suggestedStudentMapping, assertStudentPayloadRows } from "../lib/student-import-contract";
import { normalizeStudentImportRows } from "../lib/student-import";
import { readImportJson } from "../lib/import-request";
import { issueImportReceipt, requireImportReceipt } from "../lib/import-preview-receipt";
import { parseMarksCsv, MARKS_IMPORT_COLUMNS } from "../lib/marks-import";
import { parseMarkRow } from "../lib/exam-marks";
import { Prisma } from "@prisma/client";
import { studentExchangeScope, scopedStudentRow } from "../lib/student-export-scope";
import { createDryRunPlan } from "../lib/onboarding";
const sentinel = "FORBIDDEN_SYNTHETIC_SENTINEL_1A";
describe("bulk exchange privacy and context", () => {
  it("projects only reviewed fields and preserves text IDs and Unicode names", () => {
    const source = [{ "Admision No": "00007", "Full Name": "विद्यार्थी ΑΛΦΑ", "Class Name": "I", PrivateBalance: sentinel }];
    const rows = projectStudentRows(source, suggestedStudentMapping(Object.keys(source[0])));
    expect(rows).toEqual([{ admissionNo: "00007", studentName: "विद्यार्थी ΑΛΦΑ", className: "I" }]);
    expect(JSON.stringify(normalizeStudentImportRows(rows))).not.toContain(sentinel);
    expect(rows[0]).not.toBe(source[0]);
  });
  it("blocks two source columns targeting one field until explicit resolution", () => {
    const row = { "Student Name": "FIRST", "Full Name": "SECOND" };
    expect(() => projectStudentRows([row], suggestedStudentMapping(Object.keys(row)))).toThrow(/Two source/);
    expect(normalizeStudentImportRows([row]).rows[0].errors).toContain("Conflicting populated aliases for studentName");
  });
  it.each(["rawRow", "originalValues", "metadata", "extra", "balance", "__proto__"])("refuses forged field %s without echoing its value", field => {
    const forged = JSON.parse(JSON.stringify([{ admissionNo: "00001" }])) as any[];
    Object.defineProperty(forged[0], field, { value: sentinel, enumerable: true });
    try { assertStudentPayloadRows(forged); throw new Error("accepted"); } catch(e) { expect(String(e)).toContain("Disallowed Student field"); expect(String(e)).not.toContain(sentinel); }
  });
  it("creates a new canonical controlled package without excluded values", () => {
    const bytes = buildControlledSourcePackage([{ admissionNo: "00009", studentName: "INVENTED Unicode విద్యార్థి", fatherName: "INVENTED GUARDIAN", phone1: "9000000009", academicYear: "2026-27", className: "I", section: "A" }]);
    const parsed = parseOnboardingWorkbook(bytes, "STUDENT_GUARDIAN");
    expect(parsed.students[0]["Admission Number"]).toBe("00009");
    expect(parsed.guardians).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain(sentinel);
    expect(() => buildControlledSourcePackage([{ admissionNo: "00009", aadhaarNo: sentinel }])).toThrow(/Disallowed/);
  });
  it("rebuilds controlled uploads without ancillary metadata or source ZIP content", () => {
    const source = buildControlledSourcePackage([{ admissionNo: "00009", studentName: "INVENTED", fatherName: "INVENTED", phone1: "9000000009", academicYear: "2026-27", className: "I", section: "A" }]);
    const parsed = parseOnboardingWorkbook(source, "STUDENT_GUARDIAN");
    parsed.metadata.secret = sentinel;
    const canonical = canonicalOnboardingPackage(parsed, "STUDENT_GUARDIAN");
    const unpacked = Object.values(unzipSync(canonical)).map(b => new TextDecoder().decode(b)).join("");
    expect(unpacked).not.toContain(sentinel);
    expect(parseOnboardingWorkbook(canonical, "STUDENT_GUARDIAN").students[0]["Admission Number"]).toBe("00009");
    vi.useFakeTimers();
    try { vi.setSystemTime(new Date("2030-01-01")); const other = canonicalOnboardingPackage(parsed, "STUDENT_GUARDIAN"); const left = unzipSync(canonical), right = unzipSync(other); expect(Object.keys(left).filter(k => !Buffer.from(left[k]).equals(Buffer.from(right[k])))).toEqual([]); expect(other.length).toBe(canonical.length); expect([...other].map((b,i)=>b===canonical[i] ? -1 : i).filter(i=>i>=0).slice(0,30)).toEqual([]); } finally { vi.useRealTimers(); }
  });
  it("refuses forbidden marks columns locally before a preview request", () => {
    expect(() => projectMarksCsv(MARKS_IMPORT_COLUMNS.join(",") + ",extra\nE,I,A,S,C,00001,0,PRESENT,," + sentinel, false)).toThrow();
  });
  it("masks malformed JSON fragments", async () => {
    await expect(readImportJson(new Request("http://test", { method: "POST", body: `{"raw":"${sentinel}` }), ["rows"])).rejects.toThrow("Invalid import JSON. Submit a valid approved payload.");
  });
  it("bounds rows, cell size and nested values", () => {
    expect(() => assertStudentPayloadRows(Array(2001).fill({ admissionNo: "1" }))).toThrow();
    expect(() => assertStudentPayloadRows([{ studentName: "a".repeat(4001) }])).toThrow();
    expect(() => assertStudentPayloadRows([{ studentName: { secret: sentinel } }])).toThrow();
  });
  it("bounds streamed JSON and refuses extra envelope fields", async () => {
    await expect(readImportJson(new Request("http://test", { method: "POST", body: JSON.stringify({ action: "preview", extra: sentinel }) }), ["action"])).rejects.toThrow("Unexpected import request property");
    await expect(readImportJson(new Request("http://test", { method: "POST", body: "x".repeat(100) }), ["action"], 10)).rejects.toThrow(/byte limit/);
  });
  it("binds a receipt to actor, content, context, versions and expiry", () => {
    process.env.AUTH_SECRET = "synthetic-bulk-test-secret-32-characters";
    const binding = { actor: "invented-actor", csv: "one", version: 1 };
    const receipt = issueImportReceipt(binding, 1000);
    expect(() => requireImportReceipt(receipt, binding, 2000)).not.toThrow();
    for (const changed of [{ ...binding, actor: "other" }, { ...binding, csv: "two" }, { ...binding, version: 2 }]) expect(() => requireImportReceipt(receipt, changed, 2000)).toThrow();
    expect(() => requireImportReceipt(receipt, binding, 1_000_000)).toThrow();
  });
  it("preserves legacy missing-contact warnings and names exactly", () => {
    const row = normalizeStudentImportRows([{ admissionNo: "00001", studentName: "INVENTED NAME", className: "I" }]).rows[0];
    expect(row.errors).toEqual([]); expect(row.warnings).toEqual(expect.arrayContaining(["Missing phone", "Missing father name"]));
    expect(row.normalized.studentName).toBe("INVENTED NAME");
  });
  it("controlled contact omissions remain blocking; the historical optional-contact probe stays failed", async () => {
    const client = { timetableClassSection: { findMany: async () => [{ academicYear: "2026-27", className: "I", section: "A", isActive: true }] }, student: { findMany: async () => [] }, guardian: { findMany: async () => [] }, staffMember: { findMany: async () => [] }, permissionProfile: { findMany: async () => [] } } as any;
    const plan = await createDryRunPlan(client, { workbookSha256: "a".repeat(64), templateVersion: "1.0" }, { metadata: {}, students: [{ "Import Row Key": "synthetic-one", "Admission Number": "00001", "Student Full Name": "INVENTED", "Academic Year": "2026-27", Class: "I", Section: "A", "Student Status": "ACTIVE" }], guardians: [{ "Guardian Row Key": "synthetic-guardian", Name: "INVENTED GUARDIAN", Relationship: "Father" }], links: [], enrollments: [], staff: [] });
    expect(plan.summary.blockingErrorCount).toBeGreaterThan(0);
    expect(plan.issues.some(i => i.code === "FATHER_NAME_REQUIRED")).toBe(true);
    expect(plan.issues.filter(i => i.severity === "BLOCKING_ERROR" && i.column === "Phone").map(i => i.sheet)).toEqual(expect.arrayContaining(["Students", "Guardians"]));
  });
});
describe("independent marks contracts", () => {
  it("legacy CSV refuses extra values and governed columns", () => {
    expect(() => parseMarksCsv(MARKS_IMPORT_COLUMNS.join(",") + "\nE,I,A,S,C,00001,0,PRESENT,," + sentinel)).toThrow();
    expect(() => parseMarksCsv("templateVersion,studentId\nv1,one")).toThrow();
  });
  it.each(["NOT_ENTERED", "ABSENT", "EXEMPT", "NOT_APPLICABLE"])("governed %s preserves blank and refuses numeric zero", entryState => {
    const input = { studentId: "synthetic-one", entryState, expectedRowVersion: 1, marksObtained: "" };
    expect(parseMarkRow(input, new Prisma.Decimal(10), 2).marksObtained).toBeNull();
    expect(() => parseMarkRow({ ...input, marksObtained: "0" }, new Prisma.Decimal(10), 2)).toThrow();
  });
  it("governed present distinguishes blank/zero and enforces maximum/precision", () => {
    const input = { studentId: "synthetic-one", entryState: "PRESENT", expectedRowVersion: 1, marksObtained: "0" };
    expect(parseMarkRow(input, new Prisma.Decimal(10), 2).marksObtained?.toString()).toBe("0");
    for (const marksObtained of ["", "11", "1.234", "-1"]) expect(() => parseMarkRow({ ...input, marksObtained }, new Prisma.Decimal(10), 2)).toThrow();
  });
});
describe("Student export scope", () => {
  it("uses exact historical enrollment filters and canonical search", () => {
    const scope = studentExchangeScope(new URLSearchParams({ academicYear: "2025-26", className: "I", section: "A", status: "Active", q: "00001" }));
    expect(scope.where).toMatchObject({ academicYearEnrollments: { some: { academicYear: "2025-26", className: "I", section: "A", status: "ACTIVE" } }, OR: expect.any(Array) });
    const row = scopedStudentRow({ academicYear: "2026-27", className: "II", section: "B", rollNo: "2", status: "Active", academicYearEnrollments: [{ academicYear: "2025-26", className: "I", section: "A", rollNo: "1", status: "ACTIVE" }] }, "2025-26");
    expect(row.className).toBe("I"); expect(row.academicYear).toBe("2025-26");
  });
  it.each(["unexpected=yes", "academicYear=bad", "academicYear=2025-99", "className=unknown", "status=unknown", "q=a&q=b"])("refuses filter %s", query => expect(() => studentExchangeScope(new URLSearchParams(query))).toThrow());
});
