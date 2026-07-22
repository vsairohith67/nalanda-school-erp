import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateFees } from "@/lib/fee-allocation";
import { receiptPublicRows } from "@/lib/receipt";
import { getPublishedNoticesForChild, noticeAudienceLabel } from "@/lib/notices";

type ParentPortalClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "user" | "studentGuardian" | "feeStructure" | "payment" | "notice"
>;

type StudentForParent = {
  id: string;
  academicYear: string;
  admissionNo: string;
  studentName: string;
  fatherName: string;
  className: string;
  section: string | null;
  status: string | null;
  studentType: string | null;
  discountPercent: number | null;
};

export type ParentPortalChild = {
  id: string;
  academicYear: string;
  admissionNo: string;
  studentName: string;
  fatherName: string;
  className: string;
  section: string | null;
  status: string | null;
  guardianName: string;
  guardianStatus: string | null;
  guardianRelationship: string | null;
  relationshipToStudent: string;
  isPrimaryContact: boolean;
};

export type ParentFeeTerm = {
  term: number;
  dueMonth: string;
  dueAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "Paid" | "Partly Paid" | "Pending";
};

export type ParentFeeSummary = {
  yearlyFeeAmount: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
  totalPaid: number;
  pendingBalance: number;
  nextDueTerm: string | null;
  lastPaymentDate: Date | null;
  dueStatus: string;
};

export type ParentReceiptSummary = {
  receiptNo: string;
  date: Date;
  amount: number;
  paymentModeLabels: string[];
};

export type ParentNotice = {
  id: string;
  title: string;
  body: string;
  audienceLabel: string;
  publishDate: Date | null;
};

export type ParentDashboardData = {
  guardian: {
    id: string;
    displayName: string;
    relationship: string | null;
    status: string | null;
  } | null;
  children: ParentPortalChild[];
  selectedChild: ParentPortalChild | null;
  feeSummary: ParentFeeSummary | null;
  pendingDues: ParentFeeTerm[];
  receipts: ParentReceiptSummary[];
  notices: ParentNotice[];
};

export type ParentReceiptAccessRow = {
  admissionNo: string;
  studentId?: string | null;
};

type ParentPaymentRow = {
  admissionNo: string;
  studentId?: string | null;
};

export class ParentPortalAccessError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "ParentPortalAccessError";
    this.status = status;
  }
}

export async function getLinkedChildrenForParent(
  userId: string,
  client: ParentPortalClient = prisma
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      guardianId: true,
      guardian: {
        select: {
          id: true,
          displayName: true,
          relationship: true,
          status: true
        }
      }
    }
  });

  if (!user || user.role !== "PARENT") {
    throw new ParentPortalAccessError("Parent portal is available only for parent accounts.", 403);
  }

  if (!user.guardianId || !user.guardian) {
    return { guardian: null, children: [] as ParentPortalChild[] };
  }

  const links = await client.studentGuardian.findMany({
    where: {
      guardianId: user.guardianId,
      canViewFees: true,
      student: { deletedAt: null }
    },
    select: {
      relationshipToStudent: true,
      isPrimaryContact: true,
      student: {
        select: {
          id: true,
          academicYear: true,
          admissionNo: true,
          studentName: true,
          fatherName: true,
          className: true,
          section: true,
          status: true,
          studentType: true,
          discountPercent: true
        }
      }
    },
    orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }]
  });

  return {
    guardian: {
      id: user.guardian.id,
      displayName: user.guardian.displayName,
      relationship: user.guardian.relationship,
      status: user.guardian.status
    },
    children: links.map((link) => childFromLink(user.guardian!, link))
  };
}

export async function getParentDashboardData(
  userId: string,
  selectedStudent: string | null | undefined,
  client: ParentPortalClient = prisma
): Promise<ParentDashboardData> {
  const { guardian, children } = await getLinkedChildrenForParent(userId, client);
  if (!guardian || !children.length) {
    return {
      guardian,
      children,
      selectedChild: null,
      feeSummary: null,
      pendingDues: [],
      receipts: [],
      notices: []
    };
  }

  const selectedChild = selectChild(children, selectedStudent);
  if (!selectedChild) {
    throw new ParentPortalAccessError("Selected student was not found for this parent account.");
  }

  const [{ summary, pendingDues }, receipts, noticeRows] = await Promise.all([
    getParentFeeDetails(guardian.id, selectedChild.id, client),
    getParentReceipts(guardian.id, selectedChild.id, client),
    getPublishedNoticesForChild(selectedChild, client)
  ]);

  return {
    guardian,
    children,
    selectedChild,
    feeSummary: summary,
    pendingDues,
    receipts,
    notices: noticeRows.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      audienceLabel: noticeAudienceLabel(notice),
      publishDate: notice.publishDate
    }))
  };
}

export async function getParentFeeSummary(
  guardianId: string,
  studentId: string,
  client: ParentPortalClient = prisma
) {
  return (await getParentFeeDetails(guardianId, studentId, client)).summary;
}

export async function getParentPendingDues(
  guardianId: string,
  studentId: string,
  client: ParentPortalClient = prisma
) {
  return (await getParentFeeDetails(guardianId, studentId, client)).pendingDues;
}

export async function getParentReceipts(
  guardianId: string,
  studentId: string,
  client: ParentPortalClient = prisma
): Promise<ParentReceiptSummary[]> {
  const link = await getAuthorizedStudentLink(guardianId, studentId, client);
  const rows = await client.payment.findMany({
    where: {
      admissionNo: link.student.admissionNo,
      deletedAt: null,
      isCancelled: false
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });
  const authorizedRows = rows.filter((row) => paymentBelongsToAuthorizedStudent(row, link.student));
  const byReceipt = authorizedRows.reduce((map, row) => {
    map.set(row.receiptNo, [...(map.get(row.receiptNo) ?? []), row]);
    return map;
  }, new Map<string, typeof authorizedRows>());

  return [...byReceipt.entries()]
    .map(([receiptNo, receiptRows]) => {
      const publicRows = receiptPublicRows(receiptRows);
      return {
        receiptNo,
        date: latestDate(receiptRows.map((row) => row.date)),
        amount: receiptRows.reduce((sum, row) => sum + row.amountPaid, 0),
        paymentModeLabels: [...new Set(publicRows.map((row) => row.publicModeLabel))]
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.receiptNo.localeCompare(a.receiptNo));
}

export async function parentCanAccessReceiptRows(
  guardianId: string | null | undefined,
  rows: ParentReceiptAccessRow[],
  client: ParentPortalClient = prisma
) {
  if (!guardianId || !rows.length) return false;
  const links = await client.studentGuardian.findMany({
    where: {
      guardianId,
      canViewFees: true,
      student: { deletedAt: null }
    },
    select: {
      studentId: true,
      student: {
        select: {
          admissionNo: true
        }
      }
    }
  });
  const allowedStudentIds = new Set(links.map((link) => link.studentId));
  const allowedAdmissionNos = new Set(links.map((link) => link.student.admissionNo));
  return rows.every((row) => {
    if (!allowedAdmissionNos.has(row.admissionNo)) return false;
    return row.studentId ? allowedStudentIds.has(row.studentId) : true;
  });
}

/** @deprecated Notices now come from the database; kept temporarily for older callers. */
export function parentPortalNotices(): ParentNotice[] {
  return [];
}

async function getParentFeeDetails(
  guardianId: string,
  studentId: string,
  client: ParentPortalClient
): Promise<{ summary: ParentFeeSummary | null; pendingDues: ParentFeeTerm[] }> {
  const link = await getAuthorizedStudentLink(guardianId, studentId, client);
  const [feeStructure, payments] = await Promise.all([
    client.feeStructure.findFirst({
      where: {
        academicYear: link.student.academicYear,
        className: link.student.className,
        active: true
      }
    }),
    client.payment.findMany({
      where: {
        admissionNo: link.student.admissionNo,
        deletedAt: null
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    })
  ]);
  const authorizedPayments = payments.filter((payment) => paymentBelongsToAuthorizedStudent(payment, link.student));

  if (!feeStructure) return { summary: null, pendingDues: [] };

  const allocation = allocateFees(link.student, feeStructure, authorizedPayments);
  const pendingDues = allocation.terms.map((term): ParentFeeTerm => ({
    term: term.term,
    dueMonth: term.dueMonth,
    dueAmount: allocation.perTermFee,
    paidAmount: term.paid,
    pendingAmount: term.due,
    status: term.due <= 0 ? "Paid" : term.paid > 0 ? "Partly Paid" : "Pending"
  }));
  const nextDue = pendingDues.find((term) => term.pendingAmount > 0);
  const activePaymentDates = authorizedPayments
    .filter((payment) => !payment.isCancelled && !payment.deletedAt)
    .map((payment) => payment.date);

  return {
    summary: {
      yearlyFeeAmount: allocation.annualFee,
      discountPercent: allocation.effectiveDiscountPercent,
      discountAmount: roundMoney(allocation.annualFee - allocation.annualFeeAfterDiscount),
      netPayable: allocation.annualFeeAfterDiscount,
      totalPaid: allocation.totalCurrentYearPaid,
      pendingBalance: allocation.totalPending,
      nextDueTerm: nextDue ? `Term ${nextDue.term} - ${nextDue.dueMonth}` : null,
      lastPaymentDate: activePaymentDates.length ? latestDate(activePaymentDates) : null,
      dueStatus: allocation.dueStatus
    },
    pendingDues
  };
}

async function getAuthorizedStudentLink(
  guardianId: string,
  studentId: string,
  client: ParentPortalClient
) {
  const link = await client.studentGuardian.findFirst({
    where: {
      guardianId,
      studentId,
      canViewFees: true,
      student: { deletedAt: null }
    },
    select: {
      student: {
        select: {
          id: true,
          academicYear: true,
          admissionNo: true,
          studentName: true,
          fatherName: true,
          className: true,
          section: true,
          status: true,
          studentType: true,
          discountPercent: true
        }
      }
    }
  });
  if (!link) throw new ParentPortalAccessError("Student was not found for this parent account.");
  return link as { student: StudentForParent };
}

function childFromLink(
  guardian: { id: string; displayName: string; relationship: string | null; status: string | null },
  link: {
    relationshipToStudent: string;
    isPrimaryContact: boolean;
    student: StudentForParent;
  }
): ParentPortalChild {
  return {
    id: link.student.id,
    academicYear: link.student.academicYear,
    admissionNo: link.student.admissionNo,
    studentName: link.student.studentName,
    fatherName: link.student.fatherName,
    className: link.student.className,
    section: link.student.section,
    status: link.student.status,
    guardianName: guardian.displayName,
    guardianStatus: guardian.status,
    guardianRelationship: guardian.relationship,
    relationshipToStudent: link.relationshipToStudent,
    isPrimaryContact: link.isPrimaryContact
  };
}

function selectChild(children: ParentPortalChild[], selectedStudent: string | null | undefined) {
  if (!selectedStudent) return children[0] ?? null;
  return children.find((child) =>
    child.id === selectedStudent || child.admissionNo.toLowerCase() === selectedStudent.toLowerCase()
  ) ?? null;
}

function paymentBelongsToAuthorizedStudent(payment: ParentPaymentRow, student: Pick<StudentForParent, "id" | "admissionNo">) {
  if (payment.admissionNo !== student.admissionNo) return false;
  return payment.studentId ? payment.studentId === student.id : true;
}

function latestDate(dates: Date[]) {
  return dates.reduce((latest, date) => date.getTime() > latest.getTime() ? date : latest, dates[0]);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
