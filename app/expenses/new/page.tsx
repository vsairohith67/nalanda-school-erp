import { ExpenseForm } from "@/components/expense-form";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewExpensePage() { await requirePermission("MANAGE_EXPENSES"); const [vendors, categories, departments] = await Promise.all([prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, vendorCode: true }, orderBy: { name: "asc" } }), prisma.expenseCategory.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }), prisma.expenseDepartment.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } })]); return <PageShell><PageHeader title="Create Expense" description="Save a draft or submit it for approval. This does not create a student fee payment." /><ExpenseForm masters={{ vendors, categories, departments }} permissions={{ manage: true, approve: false, pay: false, cancel: false }} /></PageShell>; }
