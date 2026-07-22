import type { Prisma } from "@prisma/client";
import {
  FEE_TYPES,
  PAYMENT_MODES,
  RECEIVED_ACCOUNTS,
  TERM_HINTS,
  isValidClassName,
  normalizeClassName
} from "@/lib/constants";
import {
  assertReceiptStudentMatchInDatabase,
  requiresTransactionReference
} from "@/lib/payment-controls";

export const PAYMENT_IMPORT_MAX_ROWS = 2_000;

export type PaymentImportRow = Record<string, unknown>;

export type PaymentImportStudent = {
  id: string;
  admissionNo: string;
  studentName: string;
  className: string;
  section?: string | null;
  deletedAt?: Date | string | null;
};

export type ExistingPaymentForImport = {
  date: Date | string;
  receiptNo: string;
  admissionNo: string;
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
};

export type NormalizedPaymentImport = {
  date: string;
  receiptNo: string;
  admissionNo: string;
  studentName: string;
  className: string;
  section: string | null;
  amountPaid: number;
  paymentMode: (typeof PAYMENT_MODES)[number] | "";
  receivedAccount: (typeof RECEIVED_ACCOUNTS)[number] | "";
  transactionRefNo: string | null;
  feeType: (typeof FEE_TYPES)[number] | "";
  termHint: (typeof TERM_HINTS)[number];
  remarks: string | null;
  receivedBy: string | null;
};

export type PaymentImportPreviewRow = {
  rowNumber: number;
  normalized: NormalizedPaymentImport;
  matchedStudent: PaymentImportStudent | null;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  originalValues: PaymentImportRow;
};

export type PaymentImportPreview = {
  rows: PaymentImportPreviewRow[];
  fileWarnings: string[];
  counts: {
    total: number;
    ready: number;
    errors: number;
    warnings: number;
    duplicates: number;
  };
};

type PaymentImportField =
  | keyof NormalizedPaymentImport
  | "particulars";

const FIELD_ALIASES: Record<string, PaymentImportField> = {
  date: "date",
  paymentdate: "date",
  receiptno: "receiptNo",
  receipt: "receiptNo",
  rno: "receiptNo",
  receiptnumber: "receiptNo",
  admissionno: "admissionNo",
  admno: "admissionNo",
  studentname: "studentName",
  name: "studentName",
  nameofthestudent: "studentName",
  class: "className",
  classname: "className",
  grade: "className",
  section: "section",
  sec: "section",
  amount: "amountPaid",
  amountpaid: "amountPaid",
  paid: "amountPaid",
  feepaid: "amountPaid",
  fees: "amountPaid",
  mode: "paymentMode",
  paymentmode: "paymentMode",
  cashgpay: "paymentMode",
  account: "receivedAccount",
  receivedaccount: "receivedAccount",
  paidto: "receivedAccount",
  bankaccount: "receivedAccount",
  utr: "transactionRefNo",
  refno: "transactionRefNo",
  referenceno: "transactionRefNo",
  transactionid: "transactionRefNo",
  transactionrefno: "transactionRefNo",
  upiref: "transactionRefNo",
  particulars: "particulars",
  details: "particulars",
  description: "particulars",
  term: "termHint",
  instalment: "termHint",
  installment: "termHint",
  termhint: "termHint",
  feetype: "feeType",
  remarks: "remarks",
  note: "remarks",
  notes: "remarks",
  receivedby: "receivedBy",
  enteredby: "receivedBy"
};

export function normalizePaymentImportRows(
  rawRows: PaymentImportRow[],
  students: PaymentImportStudent[],
  existingPayments: ExistingPaymentForImport[] = [],
  currentUserName = ""
): PaymentImportPreview {
  const activeStudents = students.filter((student) => !student.deletedAt);
  const studentsByAdmission = new Map(
    activeStudents.map((student) => [normalizeKey(student.admissionNo), student])
  );
  const studentsByNameClass = new Map<string, PaymentImportStudent[]>();
  for (const student of activeStudents) {
    const key = nameClassKey(student.studentName, student.className);
    studentsByNameClass.set(key, [...(studentsByNameClass.get(key) ?? []), student]);
  }

  const databaseDuplicateKeys = new Set(existingPayments.map(paymentDuplicateKey));
  const uploadedDuplicateKeys = new Set<string>();
  const unknownHeaders = new Set<string>();

  const rows = rawRows.map((raw, index) => {
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = FIELD_ALIASES[normalizeHeader(header)];
      if (!field) {
        if (header.trim()) unknownHeaders.add(header.trim());
        continue;
      }
      mapped[field] = value;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const date = parsePaymentImportDate(mapped.date);
    const receiptNo = cleanText(mapped.receiptNo);
    const inputAdmissionNo = cleanText(mapped.admissionNo);
    const inputStudentName = cleanText(mapped.studentName).replace(/\s+/g, " ");
    const className = normalizeClassName(cleanText(mapped.className));
    const amountPaid = parsePaymentImportAmount(mapped.amountPaid);
    const mode = normalizePaymentMode(mapped.paymentMode);
    const receivedAccountWasBlank = !hasValue(mapped.receivedAccount);
    const receivedAccount = normalizeReceivedAccount(mapped.receivedAccount, mode.accountHint, mode.value);
    const feeType = normalizeFeeType(mapped.feeType);
    const termHint = normalizeTermHint(mapped.termHint);
    const transactionRefNo = cleanText(mapped.transactionRefNo) || null;
    const receivedBy = cleanText(mapped.receivedBy) || null;
    const remarks = combineRemarks(mapped.particulars, mapped.remarks);

    if (!hasValue(mapped.date)) errors.push("Missing date");
    else if (!date) errors.push("Invalid date");
    if (!receiptNo) errors.push("Missing receiptNo");
    if (!hasValue(mapped.amountPaid) || amountPaid === null) errors.push("Missing or invalid amount");
    else if (amountPaid <= 0) errors.push("Amount must be greater than zero");
    if (!mode.value) errors.push("Invalid payment mode");
    if (!receivedAccount) errors.push("Invalid received account");
    if (!feeType.value) errors.push("Invalid fee type");
    if (hasValue(mapped.className) && !isValidClassName(className)) errors.push("Invalid class");

    let matchedStudent: PaymentImportStudent | null = null;
    if (inputAdmissionNo) {
      matchedStudent = studentsByAdmission.get(normalizeKey(inputAdmissionNo)) ?? null;
      if (!matchedStudent) errors.push("Admission number not found.");
    } else {
      const matches = studentsByNameClass.get(nameClassKey(inputStudentName, className)) ?? [];
      if (matches.length === 1) {
        matchedStudent = matches[0];
        warnings.push("Matched by name and class because admission number was missing.");
      } else if (matches.length > 1) {
        errors.push("Multiple students matched; admission number required.");
      } else {
        errors.push("Student not found.");
      }
    }

    if (!hasValue(mapped.feeType)) warnings.push("Fee type missing; Current Year Fee used.");
    if (!hasValue(mapped.termHint)) warnings.push("Term hint missing; Auto used.");
    else if (!termHint.recognized) warnings.push("Term hint could not be normalized; Auto used.");
    if (receivedAccountWasBlank && receivedAccount) {
      warnings.push(`Received account was blank; defaulted to ${receivedAccount}.`);
    } else if (isUnrecognizedReceivedAccount(mapped.receivedAccount, receivedAccount)) {
      warnings.push(`Received account "${cleanText(mapped.receivedAccount)}" was not recognized; mapped to Other.`);
    }
    if (
      requiresTransactionReference(mode.value) &&
      !transactionRefNo
    ) {
      warnings.push("UPI/bank payment is missing transactionRefNo.");
    }

    const normalized: NormalizedPaymentImport = {
      date: date ?? "",
      receiptNo,
      admissionNo: matchedStudent?.admissionNo ?? inputAdmissionNo,
      studentName: matchedStudent?.studentName ?? inputStudentName,
      className: matchedStudent?.className ?? className,
      section: matchedStudent?.section ?? (cleanText(mapped.section).toUpperCase() || null),
      amountPaid: amountPaid ?? 0,
      paymentMode: mode.value,
      receivedAccount,
      transactionRefNo,
      feeType: feeType.value,
      termHint: termHint.value,
      remarks,
      receivedBy
    };

    let duplicate = false;
    if (
      matchedStudent &&
      date &&
      receiptNo &&
      amountPaid !== null &&
      amountPaid > 0 &&
      mode.value &&
      receivedAccount &&
      feeType.value
    ) {
      const key = paymentDuplicateKey(normalized);
      if (databaseDuplicateKeys.has(key)) {
        duplicate = true;
        warnings.push("Duplicate payment already exists in database; row will be skipped.");
      } else if (uploadedDuplicateKeys.has(key)) {
        duplicate = true;
        warnings.push("Duplicate payment appears in uploaded file; row will be skipped.");
      } else {
        uploadedDuplicateKeys.add(key);
      }
    }

    return {
      rowNumber: index + 2,
      normalized,
      matchedStudent,
      errors: unique(errors),
      warnings: unique(warnings),
      duplicate,
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
      ready: rows.filter((row) => row.errors.length === 0 && !row.duplicate).length,
      errors: rows.filter((row) => row.errors.length > 0).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0) + fileWarnings.length,
      duplicates: rows.filter((row) => row.duplicate).length
    }
  };
}

export function parsePaymentImportAmount(value: unknown) {
  if (!hasValue(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = cleanText(value).replace(/[₹,\s]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

export function parsePaymentImportDate(value: unknown) {
  if (!hasValue(value)) return null;
  const serial = typeof value === "number"
    ? value
    : /^\d+(\.\d+)?$/.test(cleanText(value)) ? Number(value) : null;
  if (serial !== null && Number.isFinite(serial) && serial > 0 && serial < 100_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }

  const text = cleanText(value);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dayFirst) return validDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  return null;
}

export function normalizePaymentMode(value: unknown): {
  value: NormalizedPaymentImport["paymentMode"];
  accountHint: NormalizedPaymentImport["receivedAccount"] | "";
} {
  const text = normalizePhrase(value);
  if (text === "cash") return { value: "Cash", accountHint: "Cash" };
  if (["gpay", "google pay", "director", "director gpay", "director sir gpay"].includes(text)) {
    return { value: "UPI", accountHint: "Director Sir GPay" };
  }
  if ([
    "nps",
    "nps upi",
    "nps current account upi",
    "current account upi",
    "school upi",
    "current account",
    "school current account"
  ].includes(text)) {
    return { value: "UPI", accountHint: "NPS Current Account UPI" };
  }
  if (text === "upi") return { value: "UPI", accountHint: "" };
  if (["neft", "rtgs", "imps"].includes(text)) {
    return { value: text.toUpperCase() as NormalizedPaymentImport["paymentMode"], accountHint: "NPS Bank Account" };
  }
  if (["bank", "bank transfer"].includes(text)) {
    return { value: "Bank Transfer", accountHint: "NPS Bank Account" };
  }
  if (["cheque", "check"].includes(text)) return { value: "Cheque", accountHint: "Other" };
  if (text === "other") return { value: "Other", accountHint: "Other" };
  return { value: "", accountHint: "" };
}

export function normalizeReceivedAccount(
  value: unknown,
  accountHint: NormalizedPaymentImport["receivedAccount"] | "" = "",
  paymentMode: NormalizedPaymentImport["paymentMode"] = ""
): NormalizedPaymentImport["receivedAccount"] | "" {
  const text = normalizePhrase(value);
  if (!text) {
    if (accountHint) return accountHint;
    if (paymentMode === "Cash") return "Cash";
    if (requiresTransactionReference(paymentMode) && paymentMode !== "UPI") return "NPS Bank Account";
    return paymentMode ? "Other" : "";
  }
  if (text === "cash") return "Cash";
  if (["gpay", "director", "director gpay", "director sir gpay", "personal upi"].includes(text)) {
    return "Director Sir GPay";
  }
  if ([
    "nps",
    "nps upi",
    "nps current account upi",
    "current account upi",
    "school upi",
    "current account",
    "school current account"
  ].includes(text)) {
    return "NPS Current Account UPI";
  }
  if (["bank", "bank transfer", "nps bank", "school bank", "neft", "rtgs", "imps"].includes(text)) return "NPS Bank Account";
  if (["cheque", "check", "other"].includes(text)) return "Other";
  return "Other";
}

function isUnrecognizedReceivedAccount(value: unknown, normalized: NormalizedPaymentImport["receivedAccount"] | "") {
  if (!hasValue(value) || normalized !== "Other") return false;
  return !["cheque", "check", "other"].includes(normalizePhrase(value));
}

export function paymentDuplicateKey(payment: ExistingPaymentForImport | NormalizedPaymentImport) {
  const date = typeof payment.date === "string"
    ? payment.date.slice(0, 10)
    : payment.date.toISOString().slice(0, 10);
  return [
    normalizeKey(payment.receiptNo),
    normalizeKey(payment.admissionNo),
    date,
    Number(payment.amountPaid).toFixed(2),
    normalizeKey(payment.paymentMode),
    normalizeKey(payment.receivedAccount)
  ].join("|");
}

type ImportTransactionClient = Pick<Prisma.TransactionClient, "payment" | "paymentAudit">;

export async function createImportedPaymentWithAudit(
  tx: ImportTransactionClient,
  row: PaymentImportPreviewRow,
  user: { id: string; name: string }
) {
  if (!row.matchedStudent || row.errors.length || row.duplicate) {
    throw new Error("Payment import row is not ready");
  }
  await assertReceiptStudentMatchInDatabase(tx as never, {
    receiptNo: row.normalized.receiptNo,
    admissionNo: row.matchedStudent.admissionNo
  });
  const duplicate = await tx.payment.findFirst({
    where: {
      date: new Date(`${row.normalized.date}T00:00:00.000Z`),
      receiptNo: row.normalized.receiptNo,
      admissionNo: row.matchedStudent.admissionNo,
      amountPaid: row.normalized.amountPaid,
      paymentMode: row.normalized.paymentMode,
      receivedAccount: row.normalized.receivedAccount,
      deletedAt: null
    },
    select: { id: true }
  });
  if (duplicate) throw new PaymentImportDuplicateError();
  const payment = await tx.payment.create({
    data: {
      date: new Date(`${row.normalized.date}T00:00:00.000Z`),
      receiptNo: row.normalized.receiptNo,
      admissionNo: row.matchedStudent.admissionNo,
      studentId: row.matchedStudent.id,
      studentName: row.matchedStudent.studentName,
      className: row.matchedStudent.className,
      section: row.matchedStudent.section ?? null,
      amountPaid: row.normalized.amountPaid,
      paymentMode: row.normalized.paymentMode,
      receivedAccount: row.normalized.receivedAccount,
      transactionRefNo: row.normalized.transactionRefNo,
      feeType: row.normalized.feeType,
      termHint: row.normalized.termHint,
      remarks: row.normalized.remarks,
      enteredBy: row.normalized.receivedBy || user.name,
      editedBy: null
    }
  });
  await tx.paymentAudit.create({
    data: {
      paymentId: payment.id,
      action: "CREATED",
      newValueJson: JSON.stringify(payment),
      changedByUserId: user.id,
      changedByName: user.name,
      reason: "Imported from payment file"
    }
  });
  return payment;
}

export class PaymentImportDuplicateError extends Error {
  constructor() {
    super("Duplicate payment already exists in database");
    this.name = "PaymentImportDuplicateError";
  }
}

export function assertPaymentImportRowLimit(rows: readonly unknown[]) {
  if (rows.length > PAYMENT_IMPORT_MAX_ROWS) {
    throw new Error(`Payment import is limited to ${PAYMENT_IMPORT_MAX_ROWS} rows`);
  }
}

export function paymentImportRowStatus(row: PaymentImportPreviewRow) {
  if (row.errors.length) return "Error" as const;
  if (row.duplicate) return "Duplicate" as const;
  if (row.warnings.length) return "Warning" as const;
  return "Ready" as const;
}

function normalizeFeeType(value: unknown): {
  value: NormalizedPaymentImport["feeType"];
} {
  if (!hasValue(value)) return { value: "Current Year Fee" };
  const text = normalizePhrase(value);
  if (["current", "current year", "current year fee", "tuition", "term fee", "instalment", "installment"].includes(text)) {
    return { value: "Current Year Fee" };
  }
  if (["old due", "previous due", "arrears"].includes(text)) return { value: "Old Due" };
  if (["admission", "admission fee"].includes(text)) return { value: "Admission Fee" };
  if (text === "other") return { value: "Other" };
  return { value: "" };
}

function normalizeTermHint(value: unknown): {
  value: NormalizedPaymentImport["termHint"];
  recognized: boolean;
} {
  if (!hasValue(value)) return { value: "Auto", recognized: true };
  const text = normalizePhrase(value);
  const compact = text.replace(/\s+/g, "");
  if (["i", "1", "term1", "first", "iterm"].includes(compact)) return { value: "Term 1", recognized: true };
  if (["ii", "2", "term2", "second", "iiterm"].includes(compact)) return { value: "Term 2", recognized: true };
  if (["iii", "3", "term3", "third", "iiiterm"].includes(compact)) return { value: "Term 3", recognized: true };
  if (["iv", "4", "term4", "fourth", "ivterm"].includes(compact)) return { value: "Term 4", recognized: true };
  if (["multiple", "full", "fullyear", "allterms"].includes(compact)) return { value: "Multiple", recognized: true };
  if (["auto", "default"].includes(compact)) return { value: "Auto", recognized: true };
  return { value: "Auto", recognized: false };
}

function combineRemarks(particulars: unknown, remarks: unknown) {
  const parts = [cleanText(particulars), cleanText(remarks)].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" — ") : null;
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameClassKey(name: string, className: string) {
  return `${normalizeKey(name)}|${normalizeKey(normalizeClassName(className))}`;
}

function normalizeKey(value: unknown) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizePhrase(value: unknown) {
  return normalizeKey(value).replace(/[_-]+/g, " ");
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && cleanText(value) !== "";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
