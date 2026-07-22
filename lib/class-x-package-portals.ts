import type { PrismaClient } from "@prisma/client";
import { parentDocumentStatus } from "@/lib/class-x-document-items";
import { parseClassXSnapshot, safeClassXPackage } from "@/lib/class-x-document-packages";
import { publicClassXCharge } from "@/lib/class-x-package-payments";

export async function getParentClassXPackages(client: PrismaClient, userId: string, admissionNo?: string | null) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, guardianId: true } });
  if (!user || user.role !== "PARENT" || !user.guardianId) throw new Error("Parent account is not linked to a Guardian");
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, student: { deletedAt: null } }, select: { student: { select: { id: true, admissionNo: true, studentName: true, className: true, section: true, academicYearEnrollments: { select: { academicYear: true, className: true, status: true }, orderBy: { academicYear: "desc" } } } } }, orderBy: { student: { studentName: "asc" } } });
  const selected = admissionNo ? links.find((link) => link.student.admissionNo === admissionNo)?.student : links[0]?.student;
  if (admissionNo && !selected) throw new Error("Linked child was not found");
  if (!selected) return { children: [], selectedChild: null, eligible: false, packages: [] };
  const rows = await client.classXDocumentPackage.findMany({ where: { studentId: selected.id }, include: { items: { orderBy: { displayOrder: "asc" } }, charge: { include: { linkedMiscIncomeReceipt: { select: { receiptNumber: true } } } }, handovers: { orderBy: { handoverDate: "desc" } } }, orderBy: { createdAt: "desc" } });
  return {
    children: links.map(({ student }) => ({ admissionNo: student.admissionNo, studentName: student.studentName, className: student.className, section: student.section })),
    selectedChild: { admissionNo: selected.admissionNo, studentName: selected.studentName, className: selected.className, section: selected.section },
    eligible: selected.academicYearEnrollments.some((row) => ["10", "X", "CLASS 10", "CLASS X", "10TH", "TENTH"].includes(row.className.trim().toUpperCase())),
    packages: rows.map((row) => {
      const snapshot = parseClassXSnapshot(row.templateSnapshotJson);
      return {
        ...safeClassXPackage(row),
        items: row.items.filter((item) => item.parentVisible).map((item) => ({ displayName: item.displayName, required: item.required, status: parentDocumentStatus(item.status) })),
        charge: row.charge ? publicClassXCharge(row.charge, snapshot.parentReceiptVisible === true) : null,
        handovers: row.handovers.map((handover) => ({ handoverNumber: handover.handoverNumber, handoverDate: handover.handoverDate, recipientType: handover.recipientType }))
      };
    })
  };
}
