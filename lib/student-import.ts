import { ACADEMIC_YEAR, isValidClassName, normalizeClassName } from "@/lib/constants";

export type StudentImportMode = "skip" | "update" | "create-only";
export type ImportRow = Record<string, unknown>;

export type NormalizedStudentImport = {
  academicYear: string;
  admissionNo: string;
  studentName: string;
  fatherName: string;
  motherName: string | null;
  className: string;
  section: string | null;
  rollNo: string | null;
  phone1: string;
  phone2: string | null;
  whatsappNumber: string | null;
  address: string | null;
  status: "Active" | "Cancelled" | "TC" | "Left";
  studentType: "Normal" | "Faculty Child" | "Concession";
  discountPercent: number;
  startMonth: "April" | "June";
  remarks: string | null;
  dateOfBirth: string | null;
  aadhaarNo: string | null;
  tcStatus: string | null;
};

export type StudentImportPreviewRow = {
  rowNumber: number;
  normalized: NormalizedStudentImport;
  providedFields: string[];
  errors: string[];
  warnings: string[];
  originalValues: ImportRow;
};

export type StudentImportPreview = {
  rows: StudentImportPreviewRow[];
  fileWarnings: string[];
  counts: {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    existing: number;
  };
};

const FIELD_ALIASES: Record<string, keyof NormalizedStudentImport> = {
  academicyear: "academicYear",
  admissionno: "admissionNo",
  admno: "admissionNo",
  studentname: "studentName",
  nameofthestudent: "studentName",
  name: "studentName",
  fathername: "fatherName",
  mothername: "motherName",
  class: "className",
  classname: "className",
  grade: "className",
  section: "section",
  sec: "section",
  rollno: "rollNo",
  roll: "rollNo",
  phone: "phone1",
  phoneno: "phone1",
  mobile: "phone1",
  contact: "phone1",
  phone1: "phone1",
  phone2: "phone2",
  alternatephone: "phone2",
  secondphone: "phone2",
  whatsapp: "whatsappNumber",
  whatsappnumber: "whatsappNumber",
  address: "address",
  status: "status",
  studenttype: "studentType",
  feecategory: "studentType",
  category: "studentType",
  discount: "discountPercent",
  discountpercent: "discountPercent",
  concession: "discountPercent",
  dob: "dateOfBirth",
  dateofbirth: "dateOfBirth",
  aadhaar: "aadhaarNo",
  aadhar: "aadhaarNo",
  aadharno: "aadhaarNo",
  aadhaarno: "aadhaarNo",
  tc: "tcStatus",
  transfercertificate: "tcStatus",
  tcstatus: "tcStatus",
  startmonth: "startMonth",
  remarks: "remarks"
};

export function normalizeStudentImportRows(
  rawRows: ImportRow[],
  existingAdmissionNos: ReadonlySet<string> = new Set()
): StudentImportPreview {
  const seenAdmissionNos = new Set<string>();
  const unknownHeaders = new Set<string>();
  const rows = rawRows.map((raw, index) => {
    const mapped: ImportRow = {};
    const providedFields = new Set<string>();

    for (const [header, value] of Object.entries(raw)) {
      const field = FIELD_ALIASES[normalizeHeader(header)];
      if (!field) {
        if (header.trim()) unknownHeaders.add(header.trim());
        continue;
      }
      mapped[field] = value;
      providedFields.add(field);
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const admissionNo = cleanText(mapped.admissionNo);
    const studentName = normalizePersonName(mapped.studentName);
    const className = normalizeClassName(cleanText(mapped.className));
    const studentType = normalizeStudentType(mapped.studentType);
    const status = normalizeStatus(mapped.status, mapped.tcStatus);
    const discountPercent = normalizeDiscount(mapped.discountPercent, studentType, errors);
    const startMonth: NormalizedStudentImport["startMonth"] =
      ["IX", "X"].includes(className) ? "April" : "June";
    const [phone1FromPrimary, phone2FromPrimary] = splitPhones(mapped.phone1);
    const [phone2FromSeparate] = splitPhones(mapped.phone2);
    const phone2 = phone2FromSeparate || phone2FromPrimary || null;
    const fatherName = normalizePersonName(mapped.fatherName);

    if (!admissionNo) errors.push("Missing admissionNo");
    if (!studentName) errors.push("Missing studentName");
    if (!className || !isValidClassName(className)) errors.push("Invalid class");
    if (admissionNo && seenAdmissionNos.has(admissionNo.toLowerCase())) {
      errors.push("Duplicate admissionNo in uploaded file");
    }
    if (admissionNo) seenAdmissionNos.add(admissionNo.toLowerCase());

    if (!phone1FromPrimary) warnings.push("Missing phone");
    if (!fatherName) warnings.push("Missing father name");
    if (status !== "Active") warnings.push(`Student will be imported with ${status} status`);
    if (admissionNo && existingAdmissionNos.has(admissionNo.toLowerCase())) {
      warnings.push("Admission number already exists in database");
    }

    const dateOfBirth = normalizeDate(mapped.dateOfBirth);
    if (hasValue(mapped.dateOfBirth) && !dateOfBirth) warnings.push("Date of birth could not be normalized and was ignored");

    return {
      rowNumber: index + 2,
      normalized: {
        academicYear: cleanText(mapped.academicYear) || ACADEMIC_YEAR,
        admissionNo,
        studentName,
        fatherName,
        motherName: normalizePersonName(mapped.motherName) || null,
        className,
        section: cleanText(mapped.section).toUpperCase() || null,
        rollNo: cleanText(mapped.rollNo) || null,
        phone1: phone1FromPrimary,
        phone2,
        whatsappNumber: cleanPhone(mapped.whatsappNumber) || null,
        address: cleanText(mapped.address) || null,
        status,
        studentType,
        discountPercent,
        startMonth,
        remarks: cleanText(mapped.remarks) || null,
        dateOfBirth,
        aadhaarNo: cleanDigits(mapped.aadhaarNo) || null,
        tcStatus: cleanText(mapped.tcStatus) || null
      },
      providedFields: [...providedFields],
      errors,
      warnings,
      originalValues: raw
    };
  });

  const fileWarnings = unknownHeaders.size
    ? [`Unknown optional columns ignored: ${[...unknownHeaders].join(", ")}`]
    : [];
  return {
    rows,
    fileWarnings,
    counts: {
      total: rows.length,
      valid: rows.filter((row) => row.errors.length === 0).length,
      errors: rows.filter((row) => row.errors.length > 0).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0) + fileWarnings.length,
      existing: rows.filter((row) => row.warnings.includes("Admission number already exists in database")).length
    }
  };
}

export function decideStudentImportAction(exists: boolean, mode: StudentImportMode) {
  if (!exists) return "create" as const;
  if (mode === "update") return "update" as const;
  return "skip" as const;
}

export function buildStudentImportUpdateData(row: StudentImportPreviewRow) {
  const provided = new Set(row.providedFields);
  const data: Partial<NormalizedStudentImport> = {
    academicYear: row.normalized.academicYear,
    admissionNo: row.normalized.admissionNo,
    studentName: row.normalized.studentName,
    className: row.normalized.className,
    startMonth: row.normalized.startMonth
  };

  const optionalFields: Array<keyof NormalizedStudentImport> = [
    "fatherName", "motherName", "section", "rollNo", "phone1", "phone2", "whatsappNumber",
    "address", "status", "studentType", "remarks", "dateOfBirth", "aadhaarNo", "tcStatus"
  ];
  for (const field of optionalFields) {
    if (provided.has(field)) assignImportField(data, field, row.normalized[field]);
  }
  if (provided.has("phone1") && row.normalized.phone2) {
    data.phone2 = row.normalized.phone2;
  }
  if (provided.has("discountPercent") || provided.has("studentType")) {
    data.discountPercent = row.normalized.discountPercent;
  }
  return data;
}

function assignImportField<K extends keyof NormalizedStudentImport>(
  target: Partial<NormalizedStudentImport>,
  key: K,
  value: NormalizedStudentImport[K]
) {
  target[key] = value;
}

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeStatus(value: unknown, tcValue: unknown): NormalizedStudentImport["status"] {
  const status = cleanText(value).toUpperCase().replace(/\./g, "");
  if (["CANCEL", "CANCELLED", "CANCELED"].includes(status)) return "Cancelled";
  if (["TC", "T C"].includes(status)) return "TC";
  if (status === "LEFT") return "Left";
  if (status === "ACTIVE") return "Active";
  const tc = cleanText(tcValue).toUpperCase().replace(/\./g, "");
  return tc === "TC" ? "TC" : "Active";
}

function normalizeStudentType(value: unknown): NormalizedStudentImport["studentType"] {
  const text = cleanText(value).toUpperCase();
  if (["FACULTY CHILD", "STAFF CHILD"].includes(text)) return "Faculty Child";
  if (text === "CONCESSION") return "Concession";
  return "Normal";
}

function normalizeDiscount(
  value: unknown,
  studentType: NormalizedStudentImport["studentType"],
  errors: string[]
) {
  if (!hasValue(value)) return studentType === "Faculty Child" ? 50 : 0;
  const number = Number(String(value).replace("%", "").trim());
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    errors.push("Invalid discount percent");
    return studentType === "Faculty Child" ? 50 : 0;
  }
  return number;
}

function splitPhones(value: unknown): [string, string] {
  const parts = cleanText(value).split(/[\/,;|]+/).map(cleanPhone).filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
}

function cleanPhone(value: unknown) {
  let digits = cleanDigits(value);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function cleanDigits(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}

function normalizePersonName(value: unknown) {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (!text || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeDate(value: unknown) {
  if (!hasValue(value)) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (match) {
    const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
    const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[1])
    ) return date.toISOString().slice(0, 10);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}
