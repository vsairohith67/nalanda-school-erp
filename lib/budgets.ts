import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { csvCell, localDate, moneyDecimal } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";

export const BUDGET_PLAN_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "LOCKED", "REJECTED", "CANCELLED"] as const;
export const BUDGET_REVISION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type BudgetActor = { id: string; name: string };

function requiredText(value: unknown, label: string, max = 160) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return text;
}

function optionalText(value: unknown, label: string, max = 1000) {
  const text = String(value ?? "").trim();
  if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return text || null;
}

function optionalId(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function threshold(value: unknown, label: string, fallback?: number) {
  if ((value === "" || value == null) && fallback == null) return null;
  const number = Number(value === "" || value == null ? fallback : value);
  if (!Number.isInteger(number) || number <= 0 || number > 1000) throw new Error(`${label} must be a whole number from 1 to 1000`);
  return number;
}

export function validateThresholds(warning: unknown, critical: unknown, defaults: { warning?: number; critical?: number } = {}) {
  const warningThresholdPercent = threshold(warning, "Warning threshold", defaults.warning);
  const criticalThresholdPercent = threshold(critical, "Critical threshold", defaults.critical);
  if (warningThresholdPercent != null && criticalThresholdPercent != null && warningThresholdPercent > criticalThresholdPercent) {
    throw new Error("Warning threshold must be lower than or equal to critical threshold");
  }
  return { warningThresholdPercent, criticalThresholdPercent };
}

export type ValidatedBudgetAllocation = {
  categoryId: string | null;
  departmentId: string | null;
  allocationKey: string;
  allocatedAmount: Prisma.Decimal;
  warningThresholdPercent: number | null;
  criticalThresholdPercent: number | null;
  notes: string | null;
};

export function allocationKey(categoryId: string | null, departmentId: string | null) {
  return `${categoryId ?? "*"}|${departmentId ?? "*"}`;
}

export function validateBudgetAllocations(value: unknown, defaults?: { warning: number; critical: number }): { allocations: ValidatedBudgetAllocation[]; totalAllocatedAmount: Prisma.Decimal } {
  if (!Array.isArray(value)) throw new Error("Allocations must be a list");
  if (value.length > 250) throw new Error("A budget plan cannot contain more than 250 allocations");
  const seen = new Set<string>();
  let totalAllocatedAmount = new Prisma.Decimal(0);
  const allocations = value.map((raw, index) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const categoryId = optionalId(row.categoryId);
    const departmentId = optionalId(row.departmentId);
    if (!categoryId && !departmentId) throw new Error(`Allocation ${index + 1} must choose a category or department`);
    const key = allocationKey(categoryId, departmentId);
    if (seen.has(key)) throw new Error(`Allocation ${index + 1} duplicates a category and department combination`);
    seen.add(key);
    const allocatedAmount = moneyDecimal(row.allocatedAmount, `Allocation ${index + 1} amount`, false);
    const thresholds = validateThresholds(row.warningThresholdPercent, row.criticalThresholdPercent);
    if (defaults) {
      const effectiveWarning = thresholds.warningThresholdPercent ?? defaults.warning;
      const effectiveCritical = thresholds.criticalThresholdPercent ?? defaults.critical;
      if (effectiveWarning > effectiveCritical) throw new Error(`Allocation ${index + 1} effective warning threshold must be lower than or equal to its effective critical threshold`);
    }
    totalAllocatedAmount = totalAllocatedAmount.add(allocatedAmount);
    return { categoryId, departmentId, allocationKey: key, allocatedAmount, ...thresholds, notes: optionalText(row.notes, `Allocation ${index + 1} notes`, 500) };
  });
  return { allocations, totalAllocatedAmount };
}

export function validateBudgetPlanInput(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const academicYear = requiredText(body.academicYear, "Academic year", 20);
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY");
  const thresholds = validateThresholds(body.warningThresholdPercent, body.criticalThresholdPercent, { warning: 80, critical: 100 });
  const effectiveFrom = body.effectiveFrom ? localDate(body.effectiveFrom, "Effective from") : null;
  const effectiveTo = body.effectiveTo ? localDate(body.effectiveTo, "Effective to") : null;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective to must be on or after effective from");
  const allocationResult = validateBudgetAllocations(body.allocations ?? [], { warning: thresholds.warningThresholdPercent!, critical: thresholds.criticalThresholdPercent! });
  return {
    academicYear,
    title: requiredText(body.title, "Budget title"),
    description: optionalText(body.description, "Description", 2000),
    warningThresholdPercent: thresholds.warningThresholdPercent!,
    criticalThresholdPercent: thresholds.criticalThresholdPercent!,
    effectiveFrom,
    effectiveTo,
    ...allocationResult
  };
}

export function newBudgetNumber(date = new Date()) {
  const day = schoolDateKey(date).replaceAll("-", "");
  return `BUD-${day}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export const budgetDetailInclude = {
  allocations: { include: { category: { select: { id: true, name: true, code: true } }, department: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: "asc" as const } },
  createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, lockedBy: { select: { name: true } }, cancelledBy: { select: { name: true } },
  revisions: { include: { createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { revisionNumber: "desc" as const } }
} satisfies Prisma.BudgetPlanInclude;

export async function validateActiveBudgetMasters(client: Pick<Prisma.TransactionClient, "expenseCategory" | "expenseDepartment">, allocations: ValidatedBudgetAllocation[]) {
  const categoryIds = [...new Set(allocations.flatMap((row) => row.categoryId ? [row.categoryId] : []))];
  const departmentIds = [...new Set(allocations.flatMap((row) => row.departmentId ? [row.departmentId] : []))];
  const [categories, departments] = await Promise.all([
    categoryIds.length ? client.expenseCategory.findMany({ where: { id: { in: categoryIds }, status: "ACTIVE" }, select: { id: true } }) : [],
    departmentIds.length ? client.expenseDepartment.findMany({ where: { id: { in: departmentIds }, status: "ACTIVE" }, select: { id: true } }) : []
  ]);
  if (categories.length !== categoryIds.length) throw new Error("Every selected budget category must be active");
  if (departments.length !== departmentIds.length) throw new Error("Every selected budget department must be active");
}

function reasonText(value: unknown, label: string) { return requiredText(value, label, 1000); }

export async function transitionBudget(client: PrismaClient, id: string, action: "submit" | "approve" | "reject" | "lock" | "cancel", actor: BudgetActor, reason?: unknown) {
  return client.$transaction(async (tx) => {
    const plan = await tx.budgetPlan.findUnique({ where: { id }, include: { allocations: true } });
    if (!plan) throw new Error("Budget plan not found");
    const now = new Date();
    let from: string; let to: string; let data: Prisma.BudgetPlanUncheckedUpdateManyInput;
    if (action === "submit") {
      from = "DRAFT"; to = "PENDING_APPROVAL";
      if (!plan.allocations.length || plan.totalAllocatedAmount.lte(0)) throw new Error("A budget plan must have at least one positive allocation before submission");
      data = { status: to, submittedByUserId: actor.id, submittedAt: now };
    } else if (action === "approve") {
      from = "PENDING_APPROVAL"; to = "APPROVED";
      if (!plan.allocations.length || plan.totalAllocatedAmount.lte(0)) throw new Error("A budget plan with no allocations cannot be approved");
      const official = await tx.budgetPlan.findFirst({ where: { academicYear: plan.academicYear, status: { in: ["APPROVED", "LOCKED"] }, NOT: { id } }, select: { budgetNumber: true } });
      if (official) throw new Error(`Academic year ${plan.academicYear} already has an official budget (${official.budgetNumber})`);
      data = { status: to, approvedByUserId: actor.id, approvedAt: now, rejectionReason: null };
    } else if (action === "reject") {
      from = "PENDING_APPROVAL"; to = "REJECTED";
      data = { status: to, rejectionReason: reasonText(reason, "Rejection reason") };
    } else if (action === "lock") {
      from = "APPROVED"; to = "LOCKED";
      data = { status: to, lockedByUserId: actor.id, lockedAt: now };
    } else {
      if (plan.status === "LOCKED") throw new Error("A locked budget cannot be cancelled through the normal workflow");
      if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(plan.status)) throw new Error(`Cannot cancel a ${plan.status.toLowerCase().replaceAll("_", " ")} budget`);
      from = plan.status; to = "CANCELLED";
      data = { status: to, cancellationReason: reasonText(reason, "Cancellation reason"), cancelledByUserId: actor.id, cancelledAt: now };
    }
    if (action !== "cancel" && plan.status !== from!) throw new Error(`Cannot ${action} a ${plan.status.toLowerCase().replaceAll("_", " ")} budget`);
    const updated = await tx.budgetPlan.updateMany({ where: { id, status: from! }, data });
    if (updated.count !== 1) throw new Error("Budget status changed before this action completed; refresh and try again");
    return tx.budgetPlan.findUniqueOrThrow({ where: { id }, include: budgetDetailInclude });
  });
}

type SnapshotAllocation = { categoryId: string | null; departmentId: string | null; allocationKey: string; allocatedAmount: string; warningThresholdPercent: number | null; criticalThresholdPercent: number | null; notes: string | null };
function snapshot(allocations: Array<{ categoryId: string | null; departmentId: string | null; allocationKey: string; allocatedAmount: Prisma.Decimal; warningThresholdPercent: number | null; criticalThresholdPercent: number | null; notes: string | null }>): SnapshotAllocation[] {
  return allocations.map((row) => ({ ...row, allocatedAmount: row.allocatedAmount.toFixed(2) }));
}

export async function createBudgetRevision(client: PrismaClient, planId: string, input: unknown, actor: BudgetActor) {
  const body = (input ?? {}) as Record<string, unknown>;
  const reason = reasonText(body.reason, "Revision reason");
  return client.$transaction(async (tx) => {
    const plan = await tx.budgetPlan.findUnique({ where: { id: planId }, include: { allocations: true, revisions: { select: { revisionNumber: true }, orderBy: { revisionNumber: "desc" }, take: 1 } } });
    if (!plan || !["APPROVED", "LOCKED"].includes(plan.status)) throw new Error("Only an approved or locked budget can be revised");
    const validated = validateBudgetAllocations(body.allocations, { warning: plan.warningThresholdPercent, critical: plan.criticalThresholdPercent });
    if (!validated.allocations.length) throw new Error("A revision must contain at least one allocation");
    await validateActiveBudgetMasters(tx, validated.allocations);
    const pending = await tx.budgetRevision.findFirst({ where: { budgetPlanId: planId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } }, select: { revisionNumber: true } });
    if (pending) throw new Error(`Revision ${pending.revisionNumber} must be completed before creating another revision`);
    return tx.budgetRevision.create({ data: { budgetPlanId: planId, revisionNumber: (plan.revisions[0]?.revisionNumber ?? 0) + 1, reason, previousTotalAmount: plan.totalAllocatedAmount, revisedTotalAmount: validated.totalAllocatedAmount, revisionData: JSON.stringify({ before: snapshot(plan.allocations), after: snapshot(validated.allocations) }), createdByUserId: actor.id } });
  });
}

export async function transitionBudgetRevision(client: PrismaClient, planId: string, revisionId: string, action: "submit" | "approve" | "reject" | "cancel", actor: BudgetActor, reason?: unknown) {
  return client.$transaction(async (tx) => {
    const revision = await tx.budgetRevision.findFirst({ where: { id: revisionId, budgetPlanId: planId } });
    if (!revision) throw new Error("Budget revision not found");
    const now = new Date();
    if (action === "submit") {
      const result = await tx.budgetRevision.updateMany({ where: { id: revisionId, status: "DRAFT" }, data: { status: "PENDING_APPROVAL", submittedByUserId: actor.id, submittedAt: now } });
      if (result.count !== 1) throw new Error("Only a draft revision can be submitted");
    } else if (action === "approve") {
      if (revision.status !== "PENDING_APPROVAL") throw new Error("Only a pending revision can be approved");
      const plan = await tx.budgetPlan.findUnique({ where: { id: planId } });
      if (!plan || !["APPROVED", "LOCKED"].includes(plan.status)) throw new Error("The official budget is no longer revision eligible");
      const parsed = JSON.parse(revision.revisionData) as { after: SnapshotAllocation[] };
      const validated = validateBudgetAllocations(parsed.after, { warning: plan.warningThresholdPercent, critical: plan.criticalThresholdPercent });
      await validateActiveBudgetMasters(tx, validated.allocations);
      const claim = await tx.budgetRevision.updateMany({ where: { id: revisionId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED", approvedByUserId: actor.id, approvedAt: now } });
      if (claim.count !== 1) throw new Error("Revision status changed before approval completed");
      await tx.budgetAllocation.deleteMany({ where: { budgetPlanId: planId } });
      await tx.budgetAllocation.createMany({ data: validated.allocations.map((row) => ({ budgetPlanId: planId, ...row })) });
      await tx.budgetPlan.update({ where: { id: planId }, data: { totalAllocatedAmount: validated.totalAllocatedAmount } });
    } else {
      const label = action === "reject" ? "Rejection reason" : "Cancellation reason";
      const expected = action === "reject" ? "PENDING_APPROVAL" : revision.status;
      if (action === "cancel" && !["DRAFT", "PENDING_APPROVAL"].includes(revision.status)) throw new Error("Only a draft or pending revision can be cancelled");
      const data = action === "reject" ? { status: "REJECTED", rejectionReason: reasonText(reason, label) } : { status: "CANCELLED", cancellationReason: reasonText(reason, label) };
      const result = await tx.budgetRevision.updateMany({ where: { id: revisionId, status: expected }, data });
      if (result.count !== 1) throw new Error(`Revision cannot be ${action === "reject" ? "rejected" : "cancelled"} from its current status`);
    }
    return tx.budgetRevision.findUniqueOrThrow({ where: { id: revisionId }, include: { createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } } } });
  });
}

export function calculateBudgetAmounts(allocatedValue: Prisma.Decimal.Value, netValue: Prisma.Decimal.Value, paidValue: Prisma.Decimal.Value) {
  const allocated = new Prisma.Decimal(allocatedValue);
  const net = new Prisma.Decimal(netValue);
  const paid = Prisma.Decimal.min(new Prisma.Decimal(paidValue), net);
  const committed = Prisma.Decimal.max(net.sub(paid), 0);
  const utilized = paid.add(committed);
  const available = allocated.sub(utilized);
  return { allocated, paid, committed, utilized, available, overBudget: Prisma.Decimal.max(utilized.sub(allocated), 0), utilizationPercent: allocated.gt(0) ? utilized.div(allocated).mul(100).toNumber() : null };
}

type ReportAllocation = { id: string; categoryId: string | null; departmentId: string | null; allocatedAmount: Prisma.Decimal; warningThresholdPercent: number | null; criticalThresholdPercent: number | null; category?: { name: string; code?: string | null } | null; department?: { name: string; code?: string | null } | null };
type ReportExpense = { categoryId: string; departmentId: string | null; netAmount: Prisma.Decimal; payments: Array<{ amount: Prisma.Decimal }> };

export function buildBudgetMetrics(plan: { totalAllocatedAmount: Prisma.Decimal; warningThresholdPercent: number; criticalThresholdPercent: number; allocations: ReportAllocation[] }, expenses: ReportExpense[]) {
  const actualExpenses = expenses.map((expense) => ({ ...expense, paid: expense.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0)), assigned: false }));
  const matchRank = (allocation: ReportAllocation) => allocation.categoryId && allocation.departmentId ? 0 : allocation.categoryId ? 1 : 2;
  const ordered = [...plan.allocations].sort((a, b) => matchRank(a) - matchRank(b));
  const metricsById = new Map<string, ReturnType<typeof calculateBudgetAmounts>>();
  for (const allocation of ordered) {
    const matched = actualExpenses.filter((expense) => !expense.assigned && (!allocation.categoryId || expense.categoryId === allocation.categoryId) && (!allocation.departmentId || expense.departmentId === allocation.departmentId));
    matched.forEach((expense) => { expense.assigned = true; });
    const net = matched.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0));
    const paid = matched.reduce((sum, row) => sum.add(row.paid), new Prisma.Decimal(0));
    metricsById.set(allocation.id, calculateBudgetAmounts(allocation.allocatedAmount, net, paid));
  }
  const allocations = plan.allocations.map((allocation) => {
    const amounts = metricsById.get(allocation.id) ?? calculateBudgetAmounts(allocation.allocatedAmount, 0, 0);
    const warning = allocation.warningThresholdPercent ?? plan.warningThresholdPercent;
    const critical = allocation.criticalThresholdPercent ?? plan.criticalThresholdPercent;
    const thresholdState = amounts.utilizationPercent != null && amounts.utilizationPercent >= critical ? "CRITICAL" : amounts.utilizationPercent != null && amounts.utilizationPercent >= warning ? "WARNING" : "NORMAL";
    return { ...allocation, ...amounts, warningThresholdPercent: warning, criticalThresholdPercent: critical, thresholdState };
  });
  const totalNet = actualExpenses.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0));
  const totalPaid = actualExpenses.reduce((sum, row) => sum.add(Prisma.Decimal.min(row.paid, row.netAmount)), new Prisma.Decimal(0));
  const totals = calculateBudgetAmounts(plan.totalAllocatedAmount, totalNet, totalPaid);
  const unallocatedNet = actualExpenses.filter((row) => !row.assigned).reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0));
  return { allocations, totals, unallocatedUtilized: unallocatedNet, warningCount: allocations.filter((row) => row.thresholdState === "WARNING").length, criticalCount: allocations.filter((row) => row.thresholdState === "CRITICAL").length, overBudgetCount: allocations.filter((row) => row.available.lt(0)).length };
}

export async function getBudgetMetrics(client: Pick<PrismaClient, "expenseRecord">, plan: { academicYear: string; totalAllocatedAmount: Prisma.Decimal; warningThresholdPercent: number; criticalThresholdPercent: number; allocations: ReportAllocation[] }) {
  const expenses = await client.expenseRecord.findMany({ where: { academicYear: plan.academicYear, approvalStatus: "APPROVED" }, select: { categoryId: true, departmentId: true, netAmount: true, payments: { select: { amount: true } } } });
  return buildBudgetMetrics(plan, expenses);
}

export function serializeBudget(plan: any, metrics?: ReturnType<typeof buildBudgetMetrics>) {
  const actor = (value: any) => value?.name ?? null;
  return {
    id: plan.id, budgetNumber: plan.budgetNumber, academicYear: plan.academicYear, title: plan.title, description: plan.description, status: plan.status,
    totalAllocatedAmount: plan.totalAllocatedAmount.toString(), warningThresholdPercent: plan.warningThresholdPercent, criticalThresholdPercent: plan.criticalThresholdPercent,
    effectiveFrom: plan.effectiveFrom, effectiveTo: plan.effectiveTo, rejectionReason: plan.rejectionReason, cancellationReason: plan.cancellationReason,
    createdBy: actor(plan.createdBy), submittedBy: actor(plan.submittedBy), approvedBy: actor(plan.approvedBy), lockedBy: actor(plan.lockedBy), cancelledBy: actor(plan.cancelledBy), submittedAt: plan.submittedAt, approvedAt: plan.approvedAt, lockedAt: plan.lockedAt, cancelledAt: plan.cancelledAt, createdAt: plan.createdAt, updatedAt: plan.updatedAt,
    allocations: plan.allocations?.map((row: any) => { const calculated = metrics?.allocations.find((item) => item.id === row.id); return { id: row.id, categoryId: row.categoryId, departmentId: row.departmentId, category: row.category, department: row.department, allocatedAmount: row.allocatedAmount.toString(), warningThresholdPercent: row.warningThresholdPercent, criticalThresholdPercent: row.criticalThresholdPercent, notes: row.notes, ...(calculated ? { paid: calculated.paid.toString(), committed: calculated.committed.toString(), utilized: calculated.utilized.toString(), available: calculated.available.toString(), overBudget: calculated.overBudget.toString(), utilizationPercent: calculated.utilizationPercent, thresholdState: calculated.thresholdState } : {}) }; }) ?? [],
    revisions: plan.revisions?.map((row: any) => ({ id: row.id, revisionNumber: row.revisionNumber, reason: row.reason, previousTotalAmount: row.previousTotalAmount.toString(), revisedTotalAmount: row.revisedTotalAmount.toString(), status: row.status, createdBy: actor(row.createdBy), submittedBy: actor(row.submittedBy), approvedBy: actor(row.approvedBy), submittedAt: row.submittedAt, approvedAt: row.approvedAt, rejectionReason: row.rejectionReason, cancellationReason: row.cancellationReason, createdAt: row.createdAt })) ?? [],
    ...(metrics ? { summary: { allocated: metrics.totals.allocated.toString(), paid: metrics.totals.paid.toString(), committed: metrics.totals.committed.toString(), utilized: metrics.totals.utilized.toString(), available: metrics.totals.available.toString(), overBudget: metrics.totals.overBudget.toString(), utilizationPercent: metrics.totals.utilizationPercent, unallocatedUtilized: metrics.unallocatedUtilized.toString(), warningCount: metrics.warningCount, criticalCount: metrics.criticalCount, overBudgetCount: metrics.overBudgetCount } } : {})
  };
}

export function budgetCsv(rows: Array<Record<string, unknown>>) {
  const headers = ["Budget Number", "Academic Year", "Category", "Department", "Allocated", "Committed", "Paid Actual", "Utilized", "Available", "Utilization Percent", "Threshold", "Over Budget"];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
