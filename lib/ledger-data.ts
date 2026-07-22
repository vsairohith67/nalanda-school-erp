import { prisma } from "@/lib/prisma";
import { getFeeStructures } from "@/lib/data";
import { allocateFees } from "@/lib/fee-allocation";
import { buildDetailedReminder, buildShortReminder, buildWhatsAppLink } from "@/lib/reminders";
import { getSchoolSettings } from "@/lib/school-settings";

export async function getStudentLedgerData(query: string) {
  const student = await prisma.student.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { admissionNo: { contains: query } },
        { studentName: { contains: query } },
        { phone1: { contains: query } },
        { phone2: { contains: query } },
        { whatsappNumber: { contains: query } }
      ]
    }
  });
  if (!student) return null;
  const [fees, payments, settings] = await Promise.all([
    getFeeStructures(student.academicYear),
    prisma.payment.findMany({
      where: { admissionNo: student.admissionNo, deletedAt: null },
      include: { audits: { orderBy: { createdAt: "desc" } } },
      orderBy: { date: "asc" }
    }),
    getSchoolSettings(prisma)
  ]);
  const fee = fees.find((item) => item.className === student.className);
  if (!fee) return null;
  const allocation = allocateFees(student, fee, payments);
  const reminderInput = {
    academicYear: student.academicYear,
    studentName: student.studentName,
    className: student.className,
    section: student.section,
    totalPending: allocation.totalPending,
    term1Due: allocation.terms[0].due,
    term2Due: allocation.terms[1].due,
    term3Due: allocation.terms[2].due,
    term4Due: allocation.terms[3].due,
    footer: settings.whatsappReminderFooter
  };
  const shortMessage = buildShortReminder(reminderInput);
  const detailedMessage = buildDetailedReminder(reminderInput);
  const preferredPhone = student.whatsappNumber || student.phone1;
  return {
    student,
    fee,
    payments,
    allocation,
    shortMessage,
    detailedMessage,
    preferredPhone,
    whatsappLink: buildWhatsAppLink(preferredPhone, detailedMessage)
  };
}
