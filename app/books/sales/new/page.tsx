import { BookSaleForm } from "@/components/books-finance-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { schoolDateKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function NewBookSalePage() {
  await requirePermission("MANAGE_BOOK_SALES");
  const settings = await getSchoolSettings(prisma);
  const [items, students] = await Promise.all([
    prisma.bookCatalogItem.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        itemCode: true,
        title: true,
        itemType: true,
        className: true,
        subject: true,
        studentLinkRequired: true,
        rates: { where: { academicYear: settings.academicYear, status: "ACTIVE" }, select: { id: true, itemId: true, academicYear: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true, notes: true } }
      },
      orderBy: { title: "asc" }
    }),
    prisma.student.findMany({ where: { deletedAt: null, status: "Active" }, select: { id: true, admissionNo: true, studentName: true, className: true, section: true }, orderBy: { studentName: "asc" } })
  ]);
  const serialized = items.map((item) => ({ ...item, rates: item.rates.map((rate) => ({ ...rate, amount: rate.amount.toString(), effectiveFrom: rate.effectiveFrom?.toISOString() ?? null, effectiveTo: rate.effectiveTo?.toISOString() ?? null })) }));
  return <PageShell><PageHeader title="Issue Books / Academic Materials Receipt" description="The server resolves academic-year rates, calculates exact totals, and stores immutable snapshots." /><BookSaleForm items={serialized} students={students} academicYear={settings.academicYear} today={schoolDateKey()} /></PageShell>;
}
