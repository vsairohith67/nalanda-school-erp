import { BudgetForm } from "@/components/budget-form";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewBudgetPage() { await requirePermission("MANAGE_BUDGETS"); const [categories, departments] = await Promise.all([prisma.expenseCategory.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }), prisma.expenseDepartment.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } })]); return <PageShell><PageHeader title="Create Budget" description="Build allocations, preview the calculated total, then save a draft or submit it for approval." /><BudgetForm categories={categories} departments={departments} /></PageShell>; }
