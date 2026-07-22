import { describe, expect, it } from "vitest";
import {
  getLinkedChildrenForParent,
  getParentDashboardData,
  getParentFeeSummary,
  getParentPendingDues,
  getParentReceipts,
  parentCanAccessReceiptRows
} from "../lib/parent-portal";

type FakeStudent = {
  id: string;
  academicYear: string;
  admissionNo: string;
  studentName: string;
  fatherName: string;
  className: string;
  section: string | null;
  status: string;
  studentType: string;
  discountPercent: number;
  deletedAt: Date | null;
};

type FakeLink = {
  guardianId: string;
  studentId: string;
  relationshipToStudent: string;
  isPrimaryContact: boolean;
  canViewFees: boolean;
  createdAt: Date;
};

type FakePayment = {
  id: string;
  receiptNo: string;
  admissionNo: string;
  studentId: string;
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
  transactionRefNo: string | null;
  feeType: string;
  termHint: string;
  remarks: string | null;
  isCancelled: boolean;
  deletedAt: Date | null;
  date: Date;
  createdAt: Date;
};

describe("parent portal helpers", () => {
  it("returns only fee-view children linked to the parent's guardian", async () => {
    const fake = fakeParentPortalClient();
    const { children } = await getLinkedChildrenForParent("parent-1", fake as never);

    expect(children.map((child) => child.admissionNo)).toEqual(["NPS26001", "NPS26002"]);
    expect(children.map((child) => child.admissionNo)).not.toContain("NPS26003");
    expect(children.map((child) => child.admissionNo)).not.toContain("NPS26004");
  });

  it("selects another linked child for multi-child parent switching", async () => {
    const fake = fakeParentPortalClient();
    const data = await getParentDashboardData("parent-1", "student-2", fake as never);

    expect(data.children).toHaveLength(2);
    expect(data.selectedChild?.admissionNo).toBe("NPS26002");
    expect(data.selectedChild?.studentName).toBe("Sara Reddy");
  });

  it("returns exactly one linked child for a one-child parent", async () => {
    const fake = fakeParentPortalClient();
    const { children } = await getLinkedChildrenForParent("parent-one", fake as never);

    expect(children.map((child) => child.admissionNo)).toEqual(["NPS26005"]);
  });

  it("returns the friendly empty state data when no child is linked", async () => {
    const fake = fakeParentPortalClient();
    const data = await getParentDashboardData("parent-empty", undefined, fake as never);

    expect(data.children).toEqual([]);
    expect(data.selectedChild).toBeNull();
    expect(data.feeSummary).toBeNull();
    expect(data.receipts).toEqual([]);
  });

  it("handles a parent account without guardianId safely", async () => {
    const fake = fakeParentPortalClient();
    const data = await getParentDashboardData("parent-no-guardian", undefined, fake as never);

    expect(data.guardian).toBeNull();
    expect(data.children).toEqual([]);
    expect(data.selectedChild).toBeNull();
  });

  it("keeps non-deleted inactive-status students visible with their status", async () => {
    const fake = fakeParentPortalClient();
    const { children } = await getLinkedChildrenForParent("parent-inactive-student", fake as never);

    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ admissionNo: "NPS26006", status: "Left" });
  });

  it("uses the fee allocation helper values for summary and pending dues", async () => {
    const fake = fakeParentPortalClient();
    const summary = await getParentFeeSummary("guardian-1", "student-1", fake as never);
    const pendingDues = await getParentPendingDues("guardian-1", "student-1", fake as never);

    expect(summary).toMatchObject({
      yearlyFeeAmount: 4000,
      discountPercent: 10,
      discountAmount: 400,
      netPayable: 3600,
      totalPaid: 1650,
      pendingBalance: 1950,
      nextDueTerm: "Term 2 - September"
    });
    expect(summary?.lastPaymentDate?.toISOString().slice(0, 10)).toBe("2026-07-05");
    expect(pendingDues).toEqual([
      { term: 1, dueMonth: "June", dueAmount: 900, paidAmount: 900, pendingAmount: 0, status: "Paid" },
      { term: 2, dueMonth: "September", dueAmount: 900, paidAmount: 750, pendingAmount: 150, status: "Partly Paid" },
      { term: 3, dueMonth: "December", dueAmount: 900, paidAmount: 0, pendingAmount: 900, status: "Pending" },
      { term: 4, dueMonth: "February", dueAmount: 900, paidAmount: 0, pendingAmount: 900, status: "Pending" }
    ]);
  });

  it("shows faculty child discount through the shared allocation rules", async () => {
    const fake = fakeParentPortalClient();
    const summary = await getParentFeeSummary("guardian-1", "student-2", fake as never);

    expect(summary).toMatchObject({
      yearlyFeeAmount: 4000,
      discountPercent: 50,
      discountAmount: 2000,
      netPayable: 2000,
      totalPaid: 1000,
      pendingBalance: 1000
    });
  });

  it("lists only the selected linked child's active receipts with public payment labels", async () => {
    const fake = fakeParentPortalClient();
    const receipts = await getParentReceipts("guardian-1", "student-1", fake as never);

    expect(receipts.map((receipt) => receipt.receiptNo)).toEqual(["R-SPLIT", "R-002", "R-001"]);
    expect(receipts[0]).toMatchObject({
      receiptNo: "R-SPLIT",
      amount: 300,
      paymentModeLabels: ["Cash", "UPI 1"]
    });
    expect(receipts[1]).toMatchObject({
      receiptNo: "R-002",
      amount: 450,
      paymentModeLabels: ["UPI 1"]
    });
    const labels = receipts.flatMap((receipt) => receipt.paymentModeLabels).join(" ");
    expect(labels).not.toContain("Director Sir GPay");
    expect(labels).not.toContain("NPS Current Account UPI");
    expect(labels).not.toContain("NPS Bank Account");
  });

  it("excludes inconsistent payment rows whose studentId contradicts the linked admission number", async () => {
    const fake = fakeParentPortalClient();
    const summary = await getParentFeeSummary("guardian-1", "student-1", fake as never);
    const receipts = await getParentReceipts("guardian-1", "student-1", fake as never);

    expect(summary?.totalPaid).toBe(1650);
    expect(summary?.lastPaymentDate?.toISOString().slice(0, 10)).toBe("2026-07-05");
    expect(receipts.map((receipt) => receipt.receiptNo)).not.toContain("R-MISMATCH");
  });

  it("rejects unlinked child access before fee, dues, or receipt data is returned", async () => {
    const fake = fakeParentPortalClient();

    await expect(getParentDashboardData("parent-1", "student-3", fake as never))
      .rejects.toThrow("Selected student was not found for this parent account");
    await expect(getParentDashboardData("parent-1", "NPS26003", fake as never))
      .rejects.toThrow("Selected student was not found for this parent account");
    await expect(getParentFeeSummary("guardian-1", "student-3", fake as never))
      .rejects.toThrow("Student was not found for this parent account");
    await expect(getParentReceipts("guardian-1", "student-3", fake as never))
      .rejects.toThrow("Student was not found for this parent account");
  });

  it("authorizes parent receipt print rows only when every row belongs to linked children", async () => {
    const fake = fakeParentPortalClient();

    await expect(parentCanAccessReceiptRows("guardian-1", [
      { admissionNo: "NPS26001", studentId: "student-1" },
      { admissionNo: "NPS26002", studentId: "student-2" }
    ], fake as never)).resolves.toBe(true);

    await expect(parentCanAccessReceiptRows("guardian-1", [
      { admissionNo: "NPS26001", studentId: "student-1" },
      { admissionNo: "NPS26003", studentId: "student-3" }
    ], fake as never)).resolves.toBe(false);
    await expect(parentCanAccessReceiptRows("guardian-1", [
      { admissionNo: "NPS26001", studentId: "student-3" }
    ], fake as never)).resolves.toBe(false);
    await expect(parentCanAccessReceiptRows("guardian-1", [
      { admissionNo: "NPS26001", studentId: null }
    ], fake as never)).resolves.toBe(true);
  });

  it("returns only published current notices relevant to the selected child", async () => {
    const data = await getParentDashboardData("parent-1", "student-1", fakeParentPortalClient() as never);
    expect(data.notices.map((notice) => notice.title)).toEqual([
      "All families",
      "Class I",
      "Class I-A"
    ]);
    expect(data.notices.map((notice) => notice.audienceLabel)).toEqual([
      "All Parents",
      "Class I",
      "Class I-A"
    ]);
    expect(data.notices.map((notice) => notice.title)).not.toContain("Class II");
    expect(data.notices.map((notice) => notice.title)).not.toContain("Draft");
  });
});

function fakeParentPortalClient() {
  const students = [
    student({ id: "student-1", admissionNo: "NPS26001", studentName: "Aarav Reddy", section: "A", discountPercent: 10 }),
    student({ id: "student-2", admissionNo: "NPS26002", studentName: "Sara Reddy", section: "B", studentType: "Faculty Child" }),
    student({ id: "student-3", admissionNo: "NPS26003", studentName: "Vikram Rao", section: "A" }),
    student({ id: "student-4", admissionNo: "NPS26004", studentName: "Hidden Child", section: "C" }),
    student({ id: "student-5", admissionNo: "NPS26005", studentName: "One Child", section: "D" }),
    student({ id: "student-6", admissionNo: "NPS26006", studentName: "Inactive Status Child", section: "E", status: "Left" }),
    student({ id: "student-deleted", admissionNo: "NPS26007", studentName: "Deleted Child", section: "F", deletedAt: new Date("2026-07-01T00:00:00.000Z") })
  ];
  const guardians = [
    { id: "guardian-1", displayName: "Suresh Reddy", relationship: "Father", status: "Active" },
    { id: "guardian-2", displayName: "Meera Rao", relationship: "Mother", status: "Active" },
    { id: "guardian-empty", displayName: "No Child Parent", relationship: "Parent", status: "Active" },
    { id: "guardian-one", displayName: "One Child Parent", relationship: "Parent", status: "Active" },
    { id: "guardian-inactive-student", displayName: "Inactive Status Parent", relationship: "Parent", status: "Active" }
  ];
  const users = [
    { id: "parent-1", role: "PARENT", guardianId: "guardian-1" },
    { id: "parent-empty", role: "PARENT", guardianId: "guardian-empty" },
    { id: "parent-no-guardian", role: "PARENT", guardianId: null },
    { id: "parent-one", role: "PARENT", guardianId: "guardian-one" },
    { id: "parent-inactive-student", role: "PARENT", guardianId: "guardian-inactive-student" },
    { id: "admin-1", role: "ADMIN", guardianId: null }
  ];
  const links = [
    link({ guardianId: "guardian-1", studentId: "student-1", relationshipToStudent: "Father", isPrimaryContact: true }),
    link({ guardianId: "guardian-1", studentId: "student-2", relationshipToStudent: "Father" }),
    link({ guardianId: "guardian-2", studentId: "student-3", relationshipToStudent: "Mother" }),
    link({ guardianId: "guardian-1", studentId: "student-4", relationshipToStudent: "Father", canViewFees: false }),
    link({ guardianId: "guardian-one", studentId: "student-5", relationshipToStudent: "Parent" }),
    link({ guardianId: "guardian-inactive-student", studentId: "student-6", relationshipToStudent: "Parent" }),
    link({ guardianId: "guardian-inactive-student", studentId: "student-deleted", relationshipToStudent: "Parent" })
  ];
  const feeStructures = [{
    academicYear: "2026-27",
    className: "I",
    termAmount: 1000,
    term1Month: "June",
    term2Month: "September",
    term3Month: "December",
    term4Month: "February",
    active: true
  }];
  const payments = [
    payment({ id: "payment-1", receiptNo: "R-001", admissionNo: "NPS26001", studentId: "student-1", amountPaid: 900, paymentMode: "Cash", receivedAccount: "Cash", date: "2026-06-10" }),
    payment({ id: "payment-2", receiptNo: "R-002", admissionNo: "NPS26001", studentId: "student-1", amountPaid: 450, paymentMode: "UPI", receivedAccount: "Director Sir GPay", date: "2026-07-01" }),
    payment({ id: "payment-split-cash", receiptNo: "R-SPLIT", admissionNo: "NPS26001", studentId: "student-1", amountPaid: 100, paymentMode: "Cash", receivedAccount: "Cash", date: "2026-07-05" }),
    payment({ id: "payment-split-upi", receiptNo: "R-SPLIT", admissionNo: "NPS26001", studentId: "student-1", amountPaid: 200, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI", date: "2026-07-05" }),
    payment({ id: "payment-cancelled", receiptNo: "R-CAN", admissionNo: "NPS26001", studentId: "student-1", amountPaid: 200, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI", date: "2026-07-02", isCancelled: true }),
    payment({ id: "payment-mismatch", receiptNo: "R-MISMATCH", admissionNo: "NPS26001", studentId: "student-3", amountPaid: 9999, paymentMode: "UPI", receivedAccount: "Director Sir GPay", date: "2026-07-20" }),
    payment({ id: "payment-3", receiptNo: "R-003", admissionNo: "NPS26002", studentId: "student-2", amountPaid: 1000, paymentMode: "NEFT", receivedAccount: "NPS Bank Account", date: "2026-06-12" }),
    payment({ id: "payment-4", receiptNo: "R-004", admissionNo: "NPS26003", studentId: "student-3", amountPaid: 1000, paymentMode: "Cash", receivedAccount: "Cash", date: "2026-06-13" })
  ];
  const notices = [
    notice({ id: "notice-all", title: "All families", audienceType: "ALL_PARENTS" }),
    notice({ id: "notice-class", title: "Class I", audienceType: "CLASS", className: "I" }),
    notice({ id: "notice-section", title: "Class I-A", audienceType: "SECTION", className: "I", section: "A" }),
    notice({ id: "notice-unrelated", title: "Class II", audienceType: "CLASS", className: "II" }),
    notice({ id: "notice-draft", title: "Draft", status: "DRAFT" }),
    notice({ id: "notice-archived", title: "Archived", status: "ARCHIVED" }),
    notice({ id: "notice-expired", title: "Expired", expiresAt: new Date("2026-01-01T00:00:00.000Z") })
  ];

  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = users.find((row) => row.id === where.id);
        if (!user) return null;
        return {
          ...user,
          guardian: guardians.find((guardian) => guardian.id === user.guardianId) ?? null
        };
      }
    },
    studentGuardian: {
      findMany: async ({ where }: { where: { guardianId: string; canViewFees?: boolean } }) =>
        links
          .filter((row) => row.guardianId === where.guardianId)
          .filter((row) => where.canViewFees === undefined || row.canViewFees === where.canViewFees)
          .filter((row) => students.find((student) => student.id === row.studentId)?.deletedAt === null)
          .map((row) => ({
            ...row,
            student: students.find((student) => student.id === row.studentId)!
          })),
      findFirst: async ({ where }: { where: { guardianId: string; studentId: string; canViewFees?: boolean } }) => {
        const found = links.find((row) =>
          row.guardianId === where.guardianId &&
          row.studentId === where.studentId &&
          (where.canViewFees === undefined || row.canViewFees === where.canViewFees)
        );
        const foundStudent = found ? students.find((student) => student.id === found.studentId) : null;
        return found && foundStudent?.deletedAt === null ? { student: foundStudent } : null;
      }
    },
    feeStructure: {
      findFirst: async ({ where }: { where: { academicYear: string; className: string; active: boolean } }) =>
        feeStructures.find((row) =>
          row.academicYear === where.academicYear &&
          row.className === where.className &&
          row.active === where.active
        ) ?? null
    },
    payment: {
      findMany: async ({ where }: { where: { admissionNo: string; deletedAt?: null; isCancelled?: boolean } }) =>
        payments
          .filter((row) => row.admissionNo === where.admissionNo)
          .filter((row) => where.isCancelled === undefined || row.isCancelled === where.isCancelled)
          .filter((row) => where.deletedAt !== null || row.deletedAt === null)
          .sort((a, b) => b.date.getTime() - a.date.getTime())
    },
    notice: {
      findMany: async ({ where }: { where: { OR?: Array<Record<string, unknown>>; status?: string } }) => {
        const audiences = where.OR ?? [];
        return notices.filter((row) => {
          if (row.status !== "PUBLISHED") return false;
          if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
          return audiences.some((audience) =>
            audience.audienceType === row.audienceType &&
            (audience.className === undefined || audience.className === row.className) &&
            (audience.section === undefined || audience.section === row.section)
          );
        });
      }
    }
  };
}

function notice(overrides: Partial<{
  id: string; title: string; body: string; audienceType: string; className: string | null;
  section: string | null; status: string; publishDate: Date | null; expiresAt: Date | null; createdAt: Date;
}> = {}) {
  return {
    id: "notice",
    title: "Notice",
    body: "Notice body",
    audienceType: "ALL_PARENTS",
    className: null,
    section: null,
    status: "PUBLISHED",
    publishDate: new Date("2026-06-27T00:00:00.000Z"),
    expiresAt: null,
    createdAt: new Date("2026-06-27T00:00:00.000Z"),
    ...overrides
  };
}

function student(overrides: Partial<FakeStudent> = {}): FakeStudent {
  return {
    id: "student",
    academicYear: "2026-27",
    admissionNo: "NPS26000",
    studentName: "Student",
    fatherName: "Parent",
    className: "I",
    section: null,
    status: "Active",
    studentType: "Normal",
    discountPercent: 0,
    deletedAt: null,
    ...overrides
  };
}

function link(overrides: Partial<FakeLink>): FakeLink {
  return {
    guardianId: "guardian-1",
    studentId: "student-1",
    relationshipToStudent: "Parent",
    isPrimaryContact: false,
    canViewFees: true,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides
  };
}

function payment(overrides: Partial<Omit<FakePayment, "date">> & { date?: string | Date }): FakePayment {
  const date = overrides.date instanceof Date
    ? overrides.date
    : overrides.date
      ? new Date(`${overrides.date}T00:00:00.000Z`)
      : new Date("2026-06-01T00:00:00.000Z");
  const { date: _date, ...rest } = overrides;
  return {
    id: "payment",
    receiptNo: "R-000",
    admissionNo: "NPS26000",
    studentId: "student",
    amountPaid: 0,
    paymentMode: "Cash",
    receivedAccount: "Cash",
    transactionRefNo: null,
    feeType: "Current Year Fee",
    termHint: "Auto",
    remarks: null,
    isCancelled: false,
    deletedAt: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    ...rest,
    date
  };
}
