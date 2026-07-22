import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { resolveMarksScope } from "@/lib/marks-scope";

type ScopeClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;
export type ReportCardScopeTarget = { academicYear: string; className: string; section: string; subjectNames: string[] };
export type ReportCardScope = { broad: boolean; staffLabel: string | null; targets: ReportCardScopeTarget[]; reason: string | null };

export async function resolveReportCardScope(client: ScopeClient, user: Pick<AuthUser, "id" | "role">, academicYear?: string): Promise<ReportCardScope> {
  if (user.role !== "TEACHER") return { broad: true, staffLabel: null, targets: [], reason: null };
  const marks = await resolveMarksScope(client, user, academicYear);
  const grouped = new Map<string, ReportCardScopeTarget>();
  for (const target of marks.targets) {
    const key = `${target.academicYear}|${target.className}|${target.section}`;
    const current = grouped.get(key) ?? { academicYear: target.academicYear, className: target.className, section: target.section, subjectNames: [] };
    if (!current.subjectNames.includes(target.subjectName)) current.subjectNames.push(target.subjectName);
    grouped.set(key, current);
  }
  return { broad: false, staffLabel: marks.staffLabel, targets: [...grouped.values()], reason: marks.reason };
}

export function reportCardScopeWhere(scope: ReportCardScope): Prisma.StudentReportCardWhereInput {
  if (scope.broad) return {};
  if (!scope.targets.length) return { id: "__NO_AUTHORISED_REPORT_CARD_SCOPE__" };
  return { OR: scope.targets.map((target) => ({ academicYear: target.academicYear, className: target.className, section: target.section || null })) };
}

export function requireReportCardTarget(scope: ReportCardScope, target: { academicYear: string; className: string; section: string | null }) {
  if (scope.broad) return;
  const match = scope.targets.some((item) => item.academicYear === target.academicYear && item.className === target.className && (item.section || null) === (target.section || null));
  if (!match) throw new ReportCardError(scope.reason ?? "This report card is outside your exact timetable class/section scope.", 403);
}

export class ReportCardError extends Error { constructor(message: string, public status = 400) { super(message); this.name = "ReportCardError"; } }
