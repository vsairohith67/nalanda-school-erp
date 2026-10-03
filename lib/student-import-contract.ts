/** Source mapping v1. Source objects are session-local; only projectStudentRows output may travel. */
export const STUDENT_MAPPING_VERSION = "student-fields-v1";
export const STUDENT_IMPORT_FIELDS = ["academicYear", "admissionNo", "studentName", "fatherName", "motherName", "className", "section", "rollNo", "phone1", "phone2", "whatsappNumber", "address", "status", "studentType", "discountPercent", "startMonth", "remarks", "dateOfBirth", "aadhaarNo", "tcStatus"] as const;
export type StudentField = typeof STUDENT_IMPORT_FIELDS[number];
export type StudentMapping = Record<string, StudentField | "">;
const aliases: Record<string, StudentField> = {
  admisionno: "admissionNo", studentadmissionnumber: "admissionNo", admissionnumber: "admissionNo", admno: "admissionNo",
  fullname: "studentName", nameofthestudent: "studentName", name: "studentName", fathersmobile: "phone1", mothersmobile: "phone2",
  class: "className", grade: "className", sec: "section", roll: "rollNo", phone: "phone1", phoneno: "phone1", mobile: "phone1", contact: "phone1",
  alternatephone: "phone2", secondphone: "phone2", whatsapp: "whatsappNumber", feecategory: "studentType", category: "studentType",
  discount: "discountPercent", concession: "discountPercent", dob: "dateOfBirth", aadhaar: "aadhaarNo", aadhar: "aadhaarNo", aadharno: "aadhaarNo", tc: "tcStatus", transfercertificate: "tcStatus"
};
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function suggestedStudentMapping(headers: string[]): StudentMapping {
  return Object.fromEntries(headers.map(h => [h, STUDENT_IMPORT_FIELDS.find(f => key(f) === key(h)) ?? aliases[key(h)] ?? ""]));
}
export function projectStudentRows(source: Record<string, unknown>[], mapping: StudentMapping) {
  if (!source.length || source.length > 2000 || Object.keys(mapping).length > 64) throw new Error("Use 1–2000 rows and at most 64 source columns.");
  const targets = Object.values(mapping).filter(Boolean);
  if (new Set(targets).size !== targets.length) throw new Error("Two source columns map to one field. Explicitly exclude one after checking the conflict.");
  const allowed = new Set<string>(STUDENT_IMPORT_FIELDS);
  if (targets.some(f => !allowed.has(f))) throw new Error("Unsupported target field.");
  const rows = source.map(raw => {
    const clean: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = raw[header];
      if (value != null && !["string", "number", "boolean"].includes(typeof value)) throw new Error("Only plain cell values are accepted.");
      if (String(value ?? "").length > 4000) throw new Error("A mapped cell exceeds 4000 characters.");
      clean[field] = String(value ?? "");
    }
    return clean;
  });
  assertStudentPayloadRows(rows);
  return rows;
}
export function assertStudentPayloadRows(value: unknown): asserts value is Record<string, string | number | boolean | null>[] {
  if (!Array.isArray(value) || !value.length || value.length > 2000) throw new Error("Student row limit exceeded or no rows supplied.");
  const allowed = new Set<string>(STUDENT_IMPORT_FIELDS);
  let cells = 0;
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid Student row.");
    for (const [field, cell] of Object.entries(row)) {
      if (!allowed.has(field)) throw new Error("Disallowed Student field. Review the approved mapping.");
      if (++cells > 42000 || (cell !== null && !["string", "number", "boolean"].includes(typeof cell)) || String(cell ?? "").length > 4000) throw new Error("Student payload exceeds cell limits.");
    }
  }
  if (JSON.stringify(value).length > 2_000_000) throw new Error("Student payload exceeds the output limit.");
}
