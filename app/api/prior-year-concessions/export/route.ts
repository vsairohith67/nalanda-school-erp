import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizePriorYear, priorYearBalance, readPriorYearIncome } from "@/lib/prior-year-concessions";
import { csvCell } from "@/lib/expenses";
import { concessionBalanceHash } from "@/lib/prior-year-concession-policy";
import { requireOperationalReleaseFeatureForApi, PRIOR_YEAR_CONCESSIONS_FEATURE } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest) {
  const off = requireOperationalReleaseFeatureForApi(PRIOR_YEAR_CONCESSIONS_FEATURE); if (off) return off;
  const context = await getCurrentAuthContext(); const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  const actor = { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId };
  try {
    await authorizePriorYear(prisma, actor, "EXPORT_PRIOR_YEAR_CONCESSIONS");
    await authorizePriorYear(prisma, actor, "VIEW_PRIOR_YEAR_CONCESSIONS");
    const text = await request.text(); if (Buffer.byteLength(text) > 16384) throw new Error("EXPORT_LIMIT");
    const input = JSON.parse(text);
    if (!Array.isArray(input.caseIds) || input.caseIds.length < 1 || input.caseIds.length > 50 || input.caseIds.some((id: unknown) => typeof id !== "string" || id.length > 80)) throw new Error("EXPORT_LIMIT");
    if (input.includeIncome === true) await authorizePriorYear(prisma, actor, "EXPORT_PRIOR_YEAR_INCOME");
    const rows: unknown[][] = [["Case", "Student reference", "Source year", "Operating year", "Status", "Requested", "Approved", "Previous-year remaining", ...(input.includeIncome === true ? ["Income status", "Annual income band", ...(input.exactIncome === true ? ["Exact annual INR"] : [])] : [])]];
    for (const id of [...new Set<string>(input.caseIds)]) {
      const current = await prisma.priorYearConcessionCase.findUniqueOrThrow({ where: { id } });
      const balance = await priorYearBalance(prisma, current.liabilityId);
      const income = input.includeIncome === true ? await readPriorYearIncome(prisma, actor, id, input.exactIncome === true) : null;
      rows.push([id, balance.liability.studentId, balance.liability.sourceYear, balance.liability.operatingYear, current.status, current.requestedAmount.toFixed(2), current.approvedAmount?.toFixed(2) ?? "", balance.totals.remaining.toFixed(2), ...(income ? [income.status, income.bandId ?? "", ...(input.exactIncome === true ? [income.exactAnnualAmount ?? ""] : [])] : [])]);
      await prisma.priorYearConcessionEvent.create({ data: { liabilityId: current.liabilityId, caseId: id, eventType: income ? "RESTRICTED_INCOME_EXPORTED" : "FINANCE_CASE_EXPORTED", actorId: actor.userId, reason: "Explicitly permitted case export", requestKey: randomUUID(), requestHash: concessionBalanceHash({ caseId: id, income: Boolean(income), exact: input.exactIncome === true }) } });
    }
    return new NextResponse(rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=previous-year-case-review.csv" } });
  } catch { return NextResponse.json({ error: "Export is not permitted or a case requires reconciliation." }, { status: 403, headers }); }
}
