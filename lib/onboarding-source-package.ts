import { unzipSync, zipSync } from "fflate";
import { applyCoverStyle } from "@/lib/onboarding-workbooks";
import * as XLSX from "xlsx";
import { ONBOARDING_SCHEMA_VERSION, ONBOARDING_TEMPLATE_VERSION, STUDENT_HEADERS, GUARDIAN_HEADERS, LINK_HEADERS, ENROLLMENT_HEADERS } from "@/lib/onboarding-types";
import { assertStudentPayloadRows } from "@/lib/student-import-contract";
export const CONTROLLED_SOURCE_FIELDS = ["academicYear", "admissionNo", "studentName", "fatherName", "motherName", "className", "section", "rollNo", "phone1", "phone2", "dateOfBirth", "remarks"] as const;
/** A new workbook, never the source workbook. Import row keys reuse supplied text admission references. */
export function buildControlledSourcePackage(input: Record<string, string>[]) {
  assertStudentPayloadRows(input);
  if (input.some(row => Object.keys(row).some(k => !(CONTROLLED_SOURCE_FIELDS as readonly string[]).includes(k)))) throw new Error("Disallowed controlled onboarding field.");
  if (input.some(r => !r.admissionNo || !r.studentName || !r.fatherName || !r.phone1 || !r.academicYear || !r.className)) throw new Error("Controlled onboarding requires admission, name, father name, phone, year and class. Do not invent contacts.");
  if (new Set(input.map(r => r.admissionNo)).size !== input.length) throw new Error("Duplicate admission reference.");
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add("Instructions", [["NALANDA PUBLIC SCHOOL"], ["Reviewed Student source conversion"], ["A new clean workbook. Complete required Guardian and link sheets before controlled validation. No accounts or Student records were created."], ["Admission references remain exact text. Import Row Key uses that supplied reference; no Student identifier is invented."]]);
  add("Template Metadata", [["Key", "Value"], ["Template Version", ONBOARDING_TEMPLATE_VERSION], ["Application Schema Version", ONBOARDING_SCHEMA_VERSION], ["Bundle Type", "STUDENT_GUARDIAN"]]);
  add("Academic Years", [["Academic Year"], ...[...new Set(input.map(r => r.academicYear))].map(y => [y])]);
  add("Classes and Sections", [["Academic Year", "Class", "Section"], ...input.map(r => [r.academicYear, r.className, r.section ?? ""])]);
  add("Students", [STUDENT_HEADERS, ...input.map(r => [r.admissionNo, r.admissionNo, r.studentName, r.fatherName, r.motherName ?? "", r.phone1, r.phone2 ?? "", r.dateOfBirth ?? "", r.academicYear, r.className, r.section ?? "", r.rollNo ?? "", "ACTIVE", r.remarks ?? "", "NO"])]);
  add("Guardians", [GUARDIAN_HEADERS]); add("Student-Guardian Links", [LINK_HEADERS]);
  add("Enrollments", [ENROLLMENT_HEADERS, ...input.map(r => [r.admissionNo, r.admissionNo, r.academicYear, r.className, r.section ?? "", r.rollNo ?? "", "", "ACTIVE", "NO"])]);
  add("Code Lists", [["Complete only the approved fields"]]); add("Validation Summary", [["Local conversion only; server validation remains required"]]); add("Import Batch Reference", [["No batch created"]]);
  const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }));
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Generated package exceeds 5 MB.");
  const entries = unzipSync(bytes); applyCoverStyle(entries);
  return zipSync(entries, { level: 6 });
}
