import { MiscIncomeItems } from "@/components/misc-income-items";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
export default async function MiscIncomeItemsPage() { await requirePermission("MANAGE_MISC_INCOME_ITEMS"); const [items, settings] = await Promise.all([prisma.miscIncomeItem.findMany({ include: { rates: { orderBy: [{ academicYear: "desc" }, { effectiveFrom: "desc" }] } }, orderBy: { name: "asc" } }), getSchoolSettings(prisma)]); const data = items.map((item) => ({ ...item, rates: item.rates.map((rate) => ({ ...rate, amount: rate.amount.toString() })) })); return <PageShell><PageHeader title="Income Items and Rates" description="Configure item policies and dated academic-year rates. Linked items and rates are never hard deleted." /><MiscIncomeItems items={data} academicYear={settings.academicYear} /></PageShell>; }
