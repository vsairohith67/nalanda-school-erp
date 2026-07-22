import {
  FEE_TYPES,
  PAYMENT_MODES,
  RECEIVED_ACCOUNTS,
  STUDENT_STATUSES,
  STUDENT_TYPES,
  TERM_HINTS,
  isValidClassName,
  normalizeClassName
} from "@/lib/constants";
import { numberValue } from "@/lib/format";

export function requireText(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

export function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function validateStudentPayload(body: Record<string, unknown>) {
  const className = normalizeClassName(requireText(body.className, "Class"));
  if (!isValidClassName(className)) throw new Error("Invalid class value");
  const status = String(body.status ?? "Active");
  const studentType = String(body.studentType ?? "Normal");
  if (!(STUDENT_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  if (!(STUDENT_TYPES as readonly string[]).includes(studentType)) throw new Error("Invalid student type");
  const suppliedDiscount = numberValue(body.discountPercent);
  const discountPercent = studentType === "Faculty Child" && suppliedDiscount === 0
    ? 50
    : suppliedDiscount;
  if (discountPercent < 0 || discountPercent > 100) throw new Error("Discount must be between 0 and 100");
  const dateOfBirth = body.dateOfBirth ? new Date(requireText(body.dateOfBirth, "Date of birth")) : null;
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) throw new Error("Invalid date of birth");

  return {
    academicYear: String(body.academicYear ?? "2026-27").trim() || "2026-27",
    admissionNo: requireText(body.admissionNo, "Admission number"),
    studentName: requireText(body.studentName, "Student name"),
    fatherName: requireText(body.fatherName, "Father name"),
    motherName: optionalText(body.motherName),
    className,
    section: optionalText(body.section),
    rollNo: optionalText(body.rollNo),
    phone1: requireText(body.phone1, "Phone 1"),
    phone2: optionalText(body.phone2),
    whatsappNumber: optionalText(body.whatsappNumber),
    address: optionalText(body.address),
    dateOfBirth,
    aadhaarNo: optionalText(body.aadhaarNo),
    tcStatus: optionalText(body.tcStatus),
    status,
    studentType,
    discountPercent,
    startMonth: ["IX", "X"].includes(className) ? "April" : "June",
    remarks: optionalText(body.remarks)
  };
}

export function validatePaymentPayload(body: Record<string, unknown>) {
  const amountPaid = numberValue(body.amountPaid);
  if (amountPaid <= 0) throw new Error("Payment amount must be greater than zero");
  const paymentMode = String(body.paymentMode ?? "Cash");
  const receivedAccount = String(body.receivedAccount ?? "Cash");
  const feeType = String(body.feeType ?? "Current Year Fee");
  const termHint = String(body.termHint ?? "Auto");
  if (!(PAYMENT_MODES as readonly string[]).includes(paymentMode)) throw new Error("Invalid payment mode");
  if (!(RECEIVED_ACCOUNTS as readonly string[]).includes(receivedAccount)) throw new Error("Invalid received account");
  if (!(FEE_TYPES as readonly string[]).includes(feeType)) throw new Error("Invalid fee type");
  if (!(TERM_HINTS as readonly string[]).includes(termHint)) throw new Error("Invalid term hint");

  const date = new Date(requireText(body.date, "Date"));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid payment date");

  return {
    date,
    receiptNo: requireText(body.receiptNo, "Receipt number"),
    admissionNo: requireText(body.admissionNo, "Admission number"),
    amountPaid,
    paymentMode,
    receivedAccount,
    transactionRefNo: optionalText(body.transactionRefNo),
    feeType,
    termHint,
    remarks: optionalText(body.remarks),
    enteredBy: String(body.enteredBy ?? "Director").trim() || "Director",
    editedBy: optionalText(body.editedBy)
  };
}
