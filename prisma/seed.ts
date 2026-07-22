import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";
import { ACADEMIC_YEAR, DEFAULT_FEE_STRUCTURE, dueMonthsForClass } from "../lib/constants";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { ensureSeedUsers } from "../lib/seed-users";
import { seedTimetableDefaults } from "../lib/timetable";
import { ensureDefaultMiscIncomeItems } from "../lib/misc-income";

loadEnvFile();
const prisma = new PrismaClient();

async function main() {
  const seedResult = await ensureSeedUsers(prisma);
  console.log(`Seed users created: ${seedResult.created.join(", ") || "none"}`);
  console.log(`Existing seed users preserved: ${seedResult.skipped.join(", ") || "none"}`);
  await ensureDefaultRolePermissions(prisma);
  console.log("Role permission defaults checked.");
  await ensureDefaultMiscIncomeItems(prisma);
  console.log("Default miscellaneous-income items checked; rates remain operator-configured.");

  await prisma.schoolSettings.upsert({
    where: { id: "school" },
    update: {},
    create: { id: "school" }
  });
  await seedTimetableDefaults(prisma);

  for (const group of DEFAULT_FEE_STRUCTURE) {
    for (const className of group.classes) {
      const [term1Month, term2Month, term3Month, term4Month] = dueMonthsForClass(className);
      await prisma.feeStructure.upsert({
        where: { academicYear_className: { academicYear: ACADEMIC_YEAR, className } },
        update: { termAmount: group.termAmount, term1Month, term2Month, term3Month, term4Month, active: true },
        create: { academicYear: ACADEMIC_YEAR, className, termAmount: group.termAmount, term1Month, term2Month, term3Month, term4Month }
      });
    }
  }

  const students = [
    {
      admissionNo: "NPS26001",
      studentName: "Aarav Reddy",
      fatherName: "Suresh Reddy",
      motherName: "Lakshmi Reddy",
      className: "LKG",
      section: "A",
      rollNo: "1",
      phone1: "9000000001",
      phone2: "9000000101",
      whatsappNumber: "9000000001",
      address: "Nanalnagar, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "June",
      remarks: "LKG normal sample"
    },
    {
      admissionNo: "NPS26002",
      studentName: "Sara Khan",
      fatherName: "Imran Khan",
      motherName: "Ayesha Khan",
      className: "I",
      section: "B",
      rollNo: "4",
      phone1: "9000000002",
      whatsappNumber: "9000000002",
      address: "Mehdipatnam, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "June",
      remarks: "Class I normal sample"
    },
    {
      admissionNo: "NPS26003",
      studentName: "Vihaan Sharma",
      fatherName: "Rajesh Sharma",
      motherName: "Neha Sharma",
      className: "III",
      section: "A",
      rollNo: "8",
      phone1: "9000000003",
      whatsappNumber: "9000000003",
      address: "Humayun Nagar, Hyderabad",
      studentType: "Faculty Child",
      discountPercent: 50,
      startMonth: "June",
      remarks: "Faculty child 50 percent discount"
    },
    {
      admissionNo: "NPS26004",
      studentName: "Meera Rao",
      fatherName: "Kiran Rao",
      motherName: "Anitha Rao",
      className: "IX",
      section: "A",
      rollNo: "12",
      phone1: "9000000004",
      whatsappNumber: "9000000004",
      address: "Tolichowki, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "April",
      remarks: "IX due schedule sample"
    },
    {
      admissionNo: "NPS26005",
      studentName: "Kabir Ahmed",
      fatherName: "Sameer Ahmed",
      motherName: "Sana Ahmed",
      className: "X",
      section: "A",
      rollNo: "15",
      phone1: "9000000005",
      whatsappNumber: "9000000005",
      address: "Masab Tank, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "April",
      remarks: "Class X part payment sample"
    },
    {
      admissionNo: "NPS26006",
      studentName: "Anaya Begum",
      fatherName: "Farhan Begum",
      motherName: "Zoya Begum",
      className: "VI",
      section: "C",
      rollNo: "6",
      phone1: "9000000006",
      whatsappNumber: "9000000006",
      address: "Nanalnagar, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "June",
      remarks: "Cash plus UPI split payment"
    },
    {
      admissionNo: "NPS26007",
      studentName: "Ishaan Verma",
      fatherName: "Mohan Verma",
      motherName: "Pooja Verma",
      className: "IV",
      section: "B",
      rollNo: "9",
      phone1: "9000000007",
      whatsappNumber: "9000000007",
      address: "Mehdipatnam, Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "June",
      remarks: "Full annual fee paid at once"
    },
    {
      admissionNo: "NPS26008",
      studentName: "Zara Fatima",
      fatherName: "Arif Fatima",
      motherName: "Hina Fatima",
      className: "II",
      section: "A",
      rollNo: "10",
      phone1: "9000000008",
      whatsappNumber: "9000000008",
      address: "Hyderabad",
      studentType: "Normal",
      discountPercent: 0,
      startMonth: "June",
      remarks: "Multiple small payments"
    }
  ];

  for (const student of students) {
    await prisma.student.upsert({
      where: { admissionNo: student.admissionNo },
      update: { ...student, academicYear: ACADEMIC_YEAR, status: "Active" },
      create: { ...student, academicYear: ACADEMIC_YEAR, status: "Active" }
    });
  }

  const studentRows = await prisma.student.findMany();
  const byAdmission = new Map(studentRows.map((student) => [student.admissionNo, student]));
  const payments = [
    ["2026-06-05", "12501", "NPS26002", 8600, "Cash", "Cash", "", "Current Year Fee", "Term 1", "Exact Term 1 payment"],
    ["2026-06-06", "12502", "NPS26003", 4600, "UPI", "Director Sir GPay", "GPAY4600", "Current Year Fee", "Term 1", "Faculty child discounted term"],
    ["2026-04-10", "12503", "NPS26004", 11300, "UPI", "NPS Current Account UPI", "NPSIXT1", "Current Year Fee", "Term 1", "IX April term paid"],
    ["2026-04-11", "12504", "NPS26005", 6000, "Cash", "Cash", "", "Current Year Fee", "Term 1", "Class X part payment"],
    ["2026-06-08", "12505", "NPS26006", 5000, "Cash", "Cash", "", "Current Year Fee", "Multiple", "Split receipt cash row"],
    ["2026-06-08", "12505", "NPS26006", 5000, "UPI", "Director Sir GPay", "GPAYSPLIT", "Current Year Fee", "Multiple", "Split receipt UPI row"],
    ["2026-06-09", "12506", "NPS26007", 36800, "Bank Transfer", "NPS Bank Account", "BANKFULL", "Current Year Fee", "Multiple", "Full annual fee"],
    ["2026-06-10", "12507", "NPS26008", 3000, "Cash", "Cash", "", "Current Year Fee", "Term 1", "Small payment 1"],
    ["2026-06-18", "12508", "NPS26008", 2500, "UPI", "NPS Current Account UPI", "NPS2500", "Current Year Fee", "Term 1", "Small payment 2"],
    ["2026-06-18", "12509", "NPS26001", 7800, "UPI", "NPS Current Account UPI", "", "Current Year Fee", "Term 1", "Reference intentionally missing for audit"],
    ["2026-06-18", "12510", "NPS26001", 1500, "Cash", "Cash", "", "Old Due", "Old Due", "Old due collected separately"]
  ];

  for (const item of payments) {
    const [date, receiptNo, admissionNo, amountPaid, paymentMode, receivedAccount, transactionRefNo, feeType, termHint, remarks] = item;
    const student = byAdmission.get(String(admissionNo));
    if (!student) continue;
    await prisma.payment.upsert({
      where: { id: `${receiptNo}-${admissionNo}-${paymentMode}` },
      update: {},
      create: {
        id: `${receiptNo}-${admissionNo}-${paymentMode}`,
        date: new Date(`${date}T00:00:00.000Z`),
        receiptNo: String(receiptNo),
        admissionNo: String(admissionNo),
        studentId: student.id,
        studentName: student.studentName,
        className: student.className,
        section: student.section,
        amountPaid: Number(amountPaid),
        paymentMode: String(paymentMode),
        receivedAccount: String(receivedAccount),
        transactionRefNo: String(transactionRefNo) || null,
        feeType: String(feeType),
        termHint: String(termHint),
        remarks: String(remarks),
        enteredBy: "Seed"
      }
    });
  }

  await prisma.receiptNote.upsert({
    where: { receiptNo: "12511" },
    update: { status: "Cancelled", remarks: "Cancelled in sample receipt book" },
    create: { receiptNo: "12511", status: "Cancelled", remarks: "Cancelled in sample receipt book" }
  });

  const director = await prisma.user.findUniqueOrThrow({ where: { username: "director" } });
  const allPayments = await prisma.payment.findMany();
  for (const payment of allPayments) {
    const existingAudit = await prisma.paymentAudit.findFirst({
      where: { paymentId: payment.id, action: "CREATED" }
    });
    if (!existingAudit) {
      await prisma.paymentAudit.create({
        data: {
          paymentId: payment.id,
          action: "CREATED",
          newValueJson: JSON.stringify(payment),
          changedByUserId: director.id,
          changedByName: "Director",
          reason: "Baseline entry migrated from Phase 1"
        }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
