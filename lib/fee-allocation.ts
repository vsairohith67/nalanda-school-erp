import { dueMonthsForClass } from "@/lib/constants";

export type StudentFeeProfile = {
  academicYear: string;
  admissionNo: string;
  studentName: string;
  fatherName?: string | null;
  className: string;
  section?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  status?: string | null;
  studentType?: string | null;
  discountPercent?: number | null;
  remarks?: string | null;
};

export type FeeStructureLike = {
  className: string;
  termAmount: number;
  term1Month?: string | null;
  term2Month?: string | null;
  term3Month?: string | null;
  term4Month?: string | null;
};

export type PaymentLike = {
  amountPaid: number;
  feeType: string;
  isCancelled?: boolean | null;
  deletedAt?: Date | string | null;
};

export type TermAllocation = {
  term: 1 | 2 | 3 | 4;
  dueMonth: string;
  paid: number;
  due: number;
};

export type FeeAllocation = {
  perTermFee: number;
  annualFee: number;
  effectiveDiscountPercent: number;
  annualFeeAfterDiscount: number;
  totalCurrentYearPaid: number;
  totalCurrentYearAllocated: number;
  totalPending: number;
  overpayment: number;
  oldDuesCollected: number;
  terms: TermAllocation[];
  dueStatus: "Fully Paid" | "Partial Paid" | "Defaulter" | "Not Started";
};

const monthIndex: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11
};

export function effectiveDiscountPercent(student: Pick<StudentFeeProfile, "studentType" | "discountPercent">) {
  if (typeof student.discountPercent === "number" && student.discountPercent > 0) {
    return clamp(student.discountPercent, 0, 100);
  }
  return student.studentType === "Faculty Child" ? 50 : 0;
}

export function allocateFees(
  student: StudentFeeProfile,
  feeStructure: FeeStructureLike,
  payments: PaymentLike[],
  asOf = new Date()
): FeeAllocation {
  const discount = effectiveDiscountPercent(student);
  const perTermFee = roundMoney(feeStructure.termAmount * (1 - discount / 100));
  const annualFee = roundMoney(feeStructure.termAmount * 4);
  const annualFeeAfterDiscount = roundMoney(perTermFee * 4);
  const currentYearPaid = roundMoney(
    payments
      .filter((payment) => !payment.deletedAt && !payment.isCancelled && payment.feeType === "Current Year Fee")
      .reduce((sum, payment) => sum + Math.max(0, payment.amountPaid), 0)
  );
  const oldDuesCollected = roundMoney(
    payments
      .filter((payment) => !payment.deletedAt && !payment.isCancelled && payment.feeType === "Old Due")
      .reduce((sum, payment) => sum + Math.max(0, payment.amountPaid), 0)
  );

  const totalCurrentYearAllocated = Math.min(currentYearPaid, annualFeeAfterDiscount);
  const months = [
    feeStructure.term1Month,
    feeStructure.term2Month,
    feeStructure.term3Month,
    feeStructure.term4Month
  ].every(Boolean)
    ? [feeStructure.term1Month!, feeStructure.term2Month!, feeStructure.term3Month!, feeStructure.term4Month!]
    : dueMonthsForClass(student.className);

  const terms = [0, 1, 2, 3].map((index) => {
    const paid = Math.min(Math.max(totalCurrentYearAllocated - index * perTermFee, 0), perTermFee);
    return {
      term: (index + 1) as 1 | 2 | 3 | 4,
      dueMonth: months[index],
      paid: roundMoney(paid),
      due: roundMoney(Math.max(perTermFee - paid, 0))
    };
  });

  const totalPending = roundMoney(Math.max(annualFeeAfterDiscount - currentYearPaid, 0));
  const overpayment = roundMoney(Math.max(currentYearPaid - annualFeeAfterDiscount, 0));
  const dueStatus = calculateDueStatus(terms, currentYearPaid, totalPending, student.academicYear, asOf);

  return {
    perTermFee,
    annualFee,
    effectiveDiscountPercent: discount,
    annualFeeAfterDiscount,
    totalCurrentYearPaid: currentYearPaid,
    totalCurrentYearAllocated: roundMoney(totalCurrentYearAllocated),
    totalPending,
    overpayment,
    oldDuesCollected,
    terms,
    dueStatus
  };
}

export function calculateDueStatus(
  terms: TermAllocation[],
  totalPaid: number,
  totalPending: number,
  academicYear: string,
  asOf: Date
): FeeAllocation["dueStatus"] {
  if (totalPending <= 0) return "Fully Paid";
  if (totalPaid <= 0) return "Not Started";
  const overdue = terms.some((term) => term.due > 0 && dueDateForMonth(term.dueMonth, academicYear) <= asOf);
  return overdue ? "Defaulter" : "Partial Paid";
}

export function dueDateForMonth(monthName: string, academicYear: string) {
  const yearMatch = academicYear.match(/^(\d{4})-(\d{2})$/);
  if (!yearMatch || Number(yearMatch[2]) !== (Number(yearMatch[1]) + 1) % 100) throw new Error("Academic year must use consecutive YYYY-YY format");
  const startYearText = yearMatch[1];
  const startYear = Number(startYearText);
  const month = monthIndex[monthName];
  if (month == null) throw new Error(`Unsupported fee due month: ${monthName}`);
  const year = month <= 2 ? startYear + 1 : startYear;
  return new Date(Date.UTC(year, month, 1));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
