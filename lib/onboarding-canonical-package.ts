import * as XLSX from "xlsx";
import { unzipSync, zipSync } from "fflate";
import { applyCoverStyle } from "@/lib/onboarding-workbooks";
import { STUDENT_HEADERS, GUARDIAN_HEADERS, LINK_HEADERS, ENROLLMENT_HEADERS, STAFF_HEADERS, ONBOARDING_SCHEMA_VERSION, ONBOARDING_TEMPLATE_VERSION, type OnboardingBundle } from "@/lib/onboarding-types";
import type { OnboardingWorkbookRows } from "@/lib/onboarding-types";

/** Construct a new contract-only package; never retain original ZIP entries or ancillary cells. */
export function canonicalOnboardingPackage(parsed: OnboardingWorkbookRows, bundle: OnboardingBundle) {
    const workbook = XLSX.utils.book_new();
    const canonicalTime = new Date("2000-01-01T00:00:00.000Z");
    workbook.Props = { CreatedDate: canonicalTime, ModifiedDate: canonicalTime };
    const add = (name: string, values: unknown[][]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(values), name);
    add("Instructions", [["NALANDA PUBLIC SCHOOL"], ["Canonical approved-field upload. Original workbook objects and non-contract cells excluded locally."]]);
    add("Template Metadata", [["Key", "Value"], ["Template Version", ONBOARDING_TEMPLATE_VERSION], ["Application Schema Version", ONBOARDING_SCHEMA_VERSION], ["Bundle Type", bundle]]);
    add("Academic Years", [["Academic Year"]]); add("Classes and Sections", [["Academic Year", "Class", "Section"]]);
    const project = (name: string, headers: string[], rows: Record<string, unknown>[]) => add(name, [headers, ...rows.map(row => headers.map(h => row[h] ?? ""))]);
    project("Students", STUDENT_HEADERS, parsed.students); project("Guardians", GUARDIAN_HEADERS, parsed.guardians); project("Student-Guardian Links", LINK_HEADERS, parsed.links); project("Enrollments", ENROLLMENT_HEADERS, parsed.enrollments);
    if (bundle !== "STUDENT_GUARDIAN") project("Staff", STAFF_HEADERS, parsed.staff);
    add("Code Lists", [["Server reference data is authoritative"]]); add("Validation Summary", [["Server validation required"]]); add("Import Batch Reference", [["No batch created locally"]]);
    const files = unzipSync(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true })));
    applyCoverStyle(files); const bytes = zipSync(files, { level: 6, mtime: canonicalTime });
    if (bytes.length > 5 * 1024 * 1024) throw new Error();
    return bytes;
}
