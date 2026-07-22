import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeMemberCode } from "@/lib/library-members";

type PolicyClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryPolicy" | "libraryMember" | "academicYearEnrollment">;

export function validateLibraryPolicy(input: Record<string, unknown>) {
  const policyCode = normalizeMemberCode(input.policyCode);
  const name = String(input.name ?? "").trim();
  const memberType = String(input.memberType ?? "").toUpperCase();
  const className = String(input.className ?? "").trim() || null;
  const staffType = String(input.staffType ?? "").trim().toUpperCase() || null;
  const status = String(input.status ?? "ACTIVE").toUpperCase();
  const integer = (key: string, minimum: number) => { const value = Number(input[key]); if (!Number.isInteger(value) || value < minimum) throw new Error(`${key} must be an integer of at least ${minimum}`); return value; };
  if (!name) throw new Error("Policy name is required");
  if (!['STUDENT', 'STAFF'].includes(memberType)) throw new Error("Policy member type must be STUDENT or STAFF");
  if (memberType === "STUDENT" && staffType) throw new Error("Student policies cannot have a staff type scope");
  if (memberType === "STAFF" && className) throw new Error("Staff policies cannot have a class scope");
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error("Policy status must be ACTIVE or INACTIVE");
  return {
    policyCode, name, memberType, className: memberType === "STUDENT" ? className : null,
    staffType: memberType === "STAFF" ? staffType : null,
    maxActiveLoans: integer("maxActiveLoans", 1), loanPeriodDays: integer("loanPeriodDays", 1),
    maxRenewals: integer("maxRenewals", 0), renewalPeriodDays: integer("renewalPeriodDays", 1),
    reservationLimit: integer("reservationLimit", 0), priority: integer("priority", 0), status,
    notes: String(input.notes ?? "").trim() || null
  };
}

async function assertNoPolicyConflict(client: PolicyClient, data: ReturnType<typeof validateLibraryPolicy>, excludingId?: string) {
  if (data.status !== "ACTIVE") return;
  const rows = await client.libraryPolicy.findMany({ where: { memberType: data.memberType, status: "ACTIVE", priority: data.priority, ...(excludingId ? { id: { not: excludingId } } : {}) } });
  if (rows.some((row) => (row.className ?? null) === data.className && (row.staffType ?? null) === data.staffType)) throw new Error("An active policy already exists for this exact scope and priority");
}

export async function createLibraryPolicy(client: PolicyClient, input: Record<string, unknown>, actorUserId: string) {
  const data = validateLibraryPolicy(input); await assertNoPolicyConflict(client, data);
  return client.libraryPolicy.create({ data: { ...data, createdByUserId: actorUserId } });
}

export async function updateLibraryPolicy(client: PolicyClient, id: string, input: Record<string, unknown>) {
  const data = validateLibraryPolicy(input); await assertNoPolicyConflict(client, data, id);
  if (!(await client.libraryPolicy.findUnique({ where: { id }, select: { id: true } }))) throw new Error("Library policy not found");
  return client.libraryPolicy.update({ where: { id }, data });
}

export async function resolveLibraryPolicy(client: PolicyClient, memberId: string) {
  const member = await client.libraryMember.findUnique({ where: { id: memberId }, include: { student: { select: { academicYearEnrollments: { where: { status: "ACTIVE" }, orderBy: { academicYear: "desc" }, take: 1 }, className: true } }, staffMember: { select: { staffType: true, designation: true } } } });
  if (!member) throw new Error("Library member not found");
  const policies = await client.libraryPolicy.findMany({ where: { memberType: member.memberType, status: "ACTIVE" }, orderBy: [{ priority: "desc" }, { policyCode: "asc" }] });
  let scopeLabel = "general member-type policy";
  let candidates: typeof policies = [];
  if (member.memberType === "STUDENT") {
    const className = member.student?.academicYearEnrollments[0]?.className ?? member.student?.className;
    candidates = policies.filter((policy) => policy.className === className);
    if (candidates.length) scopeLabel = `exact Student class policy (${className})`;
  } else {
    const types = [member.staffMember?.staffType, member.staffMember?.designation].filter(Boolean).map((value) => String(value).trim().toUpperCase());
    candidates = policies.filter((policy) => policy.staffType && types.includes(policy.staffType.toUpperCase()));
    if (candidates.length) scopeLabel = `exact Staff type policy (${candidates[0].staffType})`;
  }
  if (!candidates.length) candidates = policies.filter((policy) => !policy.className && !policy.staffType);
  if (!candidates.length) throw new Error(`No active ${member.memberType} borrowing policy is configured`);
  const highest = candidates[0].priority;
  const tied = candidates.filter((policy) => policy.priority === highest);
  if (tied.length !== 1) throw new Error("Ambiguous active borrowing policies match this member; resolve the configuration conflict");
  return { policy: tied[0], scopeLabel };
}
