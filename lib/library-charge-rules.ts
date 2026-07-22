import { Prisma, type PrismaClient } from "@prisma/client";
import { moneyDecimal } from "@/lib/expenses";
import { normalizeMemberCode } from "@/lib/library-members";

type RuleClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryChargeRule" | "libraryMember">;
export const LOST_CHARGE_BASES = ["MANUAL", "ACQUISITION_COST", "FIXED_AMOUNT"] as const;
export const DAMAGED_CHARGE_BASES = ["MANUAL", "FIXED_AMOUNT"] as const;

function optionalMoney(value: unknown, label: string) {
  return String(value ?? "").trim() ? moneyDecimal(value, label) : null;
}

export function validateLibraryChargeRule(input: Record<string, unknown>) {
  const ruleCode = normalizeMemberCode(input.ruleCode);
  const name = String(input.name ?? "").trim();
  const memberType = String(input.memberType ?? "").toUpperCase();
  const className = String(input.className ?? "").trim() || null;
  const staffType = String(input.staffType ?? "").trim().toUpperCase() || null;
  const status = String(input.status ?? "ACTIVE").toUpperCase();
  const graceDays = Number(input.graceDays ?? 0);
  const priority = Number(input.priority ?? 0);
  const overdueAmountPerDay = moneyDecimal(input.overdueAmountPerDay, "Overdue amount per day");
  const maximumOverdueAmount = optionalMoney(input.maximumOverdueAmount, "Maximum overdue amount");
  const lostChargeBasis = String(input.lostChargeBasis ?? "MANUAL").toUpperCase();
  const fixedLostAmount = optionalMoney(input.fixedLostAmount, "Fixed lost amount");
  const damagedChargeBasis = String(input.damagedChargeBasis ?? "MANUAL").toUpperCase();
  const fixedDamagedAmount = optionalMoney(input.fixedDamagedAmount, "Fixed damaged amount");
  if (!name || name.length > 120) throw new Error("Rule name is required and must be at most 120 characters");
  if (!['STUDENT', 'STAFF'].includes(memberType)) throw new Error("Rule member type must be STUDENT or STAFF");
  if (memberType === "STUDENT" && staffType) throw new Error("Student rules cannot have a staff type scope");
  if (memberType === "STAFF" && className) throw new Error("Staff rules cannot have a class scope");
  if (!Number.isInteger(graceDays) || graceDays < 0) throw new Error("Grace days must be a non-negative whole number");
  if (!Number.isInteger(priority) || priority < 0) throw new Error("Priority must be a non-negative whole number");
  if (overdueAmountPerDay.lte(0)) throw new Error("Overdue amount per day must be greater than zero");
  if (maximumOverdueAmount && maximumOverdueAmount.lte(0)) throw new Error("Maximum overdue amount must be greater than zero");
  if (!LOST_CHARGE_BASES.includes(lostChargeBasis as never)) throw new Error("Unsupported lost charge basis");
  if (!DAMAGED_CHARGE_BASES.includes(damagedChargeBasis as never)) throw new Error("Unsupported damaged charge basis");
  if (lostChargeBasis === "FIXED_AMOUNT" && (!fixedLostAmount || fixedLostAmount.lte(0))) throw new Error("A positive fixed lost amount is required");
  if (damagedChargeBasis === "FIXED_AMOUNT" && (!fixedDamagedAmount || fixedDamagedAmount.lte(0))) throw new Error("A positive fixed damaged amount is required");
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error("Rule status must be ACTIVE or INACTIVE");
  return { ruleCode, name, memberType, className: memberType === "STUDENT" ? className : null, staffType: memberType === "STAFF" ? staffType : null, graceDays, overdueAmountPerDay, maximumOverdueAmount, lostChargeBasis, fixedLostAmount: lostChargeBasis === "FIXED_AMOUNT" ? fixedLostAmount : null, damagedChargeBasis, fixedDamagedAmount: damagedChargeBasis === "FIXED_AMOUNT" ? fixedDamagedAmount : null, priority, status, notes: String(input.notes ?? "").trim() || null };
}

async function assertNoAmbiguity(client: RuleClient, data: ReturnType<typeof validateLibraryChargeRule>, excludingId?: string) {
  if (data.status !== "ACTIVE") return;
  const rows = await client.libraryChargeRule.findMany({ where: { memberType: data.memberType, status: "ACTIVE", priority: data.priority, ...(excludingId ? { id: { not: excludingId } } : {}) } });
  if (rows.some((row) => (row.className ?? null) === data.className && (row.staffType ?? null) === data.staffType)) throw new Error("An active charge rule already exists for this exact scope and priority");
}

export async function createLibraryChargeRule(client: RuleClient, input: Record<string, unknown>, actorUserId: string) {
  const data = validateLibraryChargeRule(input); await assertNoAmbiguity(client, data);
  return client.libraryChargeRule.create({ data: { ...data, createdByUserId: actorUserId } });
}

export async function updateLibraryChargeRule(client: RuleClient, id: string, input: Record<string, unknown>) {
  const data = validateLibraryChargeRule(input); await assertNoAmbiguity(client, data, id);
  if (!(await client.libraryChargeRule.findUnique({ where: { id }, select: { id: true } }))) throw new Error("Library charge rule not found");
  return client.libraryChargeRule.update({ where: { id }, data });
}

export async function resolveLibraryChargeRule(client: RuleClient, memberId: string) {
  const member = await client.libraryMember.findUnique({ where: { id: memberId }, include: { student: { select: { className: true, academicYearEnrollments: { where: { status: "ACTIVE" }, orderBy: { academicYear: "desc" }, take: 1, select: { className: true } } } }, staffMember: { select: { staffType: true, designation: true } } } });
  if (!member) throw new Error("Library member not found");
  const rules = await client.libraryChargeRule.findMany({ where: { memberType: member.memberType, status: "ACTIVE" }, orderBy: [{ priority: "desc" }, { ruleCode: "asc" }] });
  let candidates = [] as typeof rules; let scopeLabel = "general member type";
  if (member.memberType === "STUDENT") {
    const className = member.student?.academicYearEnrollments[0]?.className ?? member.student?.className;
    candidates = rules.filter((rule) => rule.className === className);
    if (candidates.length) scopeLabel = `exact Student class (${className})`;
  } else {
    const types = new Set([member.staffMember?.staffType, member.staffMember?.designation].filter(Boolean).map((v) => String(v).trim().toUpperCase()));
    candidates = rules.filter((rule) => rule.staffType && types.has(rule.staffType.toUpperCase()));
    if (candidates.length) scopeLabel = `exact Staff type (${candidates[0].staffType})`;
  }
  if (!candidates.length) candidates = rules.filter((rule) => !rule.className && !rule.staffType);
  if (!candidates.length) return { rule: null, scopeLabel: "manual assessment required", warning: `No active ${member.memberType} charge rule applies; an authorized manual amount and reason are required.` };
  const highest = candidates[0].priority; const tied = candidates.filter((rule) => rule.priority === highest);
  if (tied.length !== 1) throw new Error("Ambiguous active charge rules match this member; resolve the configuration conflict");
  return { rule: tied[0], scopeLabel, warning: null };
}

export function overdueSuggestion(rule: { graceDays: number; overdueAmountPerDay: Prisma.Decimal; maximumOverdueAmount: Prisma.Decimal | null } | null, overdueDays: number) {
  if (!rule) return null;
  const chargeableDays = Math.max(0, overdueDays - rule.graceDays);
  let amount = rule.overdueAmountPerDay.mul(chargeableDays);
  if (rule.maximumOverdueAmount && amount.gt(rule.maximumOverdueAmount)) amount = rule.maximumOverdueAmount;
  return { chargeableDays, amount };
}
