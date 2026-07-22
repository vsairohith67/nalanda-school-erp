import Link from "next/link";
import { PublisherBillForm } from "@/components/books-finance-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { schoolDateKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
export default async function NewPublisherBillPage() { await requirePermission("MANAGE_PUBLISHER_BILLS"); const [settings, vendors] = await Promise.all([getSchoolSettings(prisma), prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, vendorCode: true }, orderBy: { name: "asc" } })]); return <PageShell><PageHeader title="Create Publisher Bill" description="Creates an unpaid ExpenseRecord draft in Books & Academic Materials. No payment is created automatically." action={<Link className="button secondary" href="/books/publisher-bills">Back</Link>} /><PublisherBillForm vendors={vendors} academicYear={settings.academicYear} today={schoolDateKey()} /><PageHeader title="Create Library Management Service Expense" description="Creates a Professional Fees / Library ExpenseRecord draft for an approved service-provider vendor. It does not use payroll, and the amount is never hardcoded." /><PublisherBillForm vendors={vendors} academicYear={settings.academicYear} today={schoolDateKey()} service /></PageShell>; }
