import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizePriorYear, mutatePriorYear, priorYearBalance } from "@/lib/prior-year-concessions";
import { requireOperationalReleaseFeatureForApi, PRIOR_YEAR_CONCESSIONS_FEATURE } from "@/lib/release-feature-flag-runtime";
import policy from "@/config/prior-year-concession-policy.json";
import { sourceProposalStatus } from "@/lib/prior-year-concession-policy";
import { allocateFees } from "@/lib/fee-allocation";
import { effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: NextRequest) {
  const off = requireOperationalReleaseFeatureForApi(PRIOR_YEAR_CONCESSIONS_FEATURE); if (off) return off;
  const context = await getCurrentAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  const actor = { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId };
  try {
    await authorizePriorYear(prisma, actor, "VIEW_PRIOR_YEAR_CONCESSIONS");
    const id = request.nextUrl.searchParams.get("id");
    const page = Math.min(10000, Math.max(0, Number(request.nextUrl.searchParams.get("page")) || 0));
    const cases = await prisma.priorYearConcessionCase.findMany({ skip: page * 50, take: 50, orderBy: { createdAt: "desc" }, include: { liability: { select: { studentId: true, operatingYear: true, sourceYear: true, status: true, sourceReferencesJson: true, provenance: true } } } });
    if (id && !cases.some((item) => item.id === id)) {
      const selected = await prisma.priorYearConcessionCase.findUnique({ where: { id }, include: { liability: { select: { studentId: true, operatingYear: true, sourceYear: true, status: true, sourceReferencesJson: true, provenance: true } } } });
      if (selected) cases.push(selected);
    }
    const liabilities = await prisma.priorYearLiability.findMany({ skip: page * 100, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, studentId: true, operatingYear: true, sourceYear: true, sourceEnrollmentId: true, openingAmount: true, existingCredits: true, sourceReferencesJson: true, provenance: true, status: true, version: true, preparerId: true, verifierId: true } });
    const missing = cases.map((item) => item.liabilityId).filter((id) => !liabilities.some((row) => row.id === id));
    if (missing.length) liabilities.push(...await prisma.priorYearLiability.findMany({ where: { id: { in: missing } }, select: { id: true, studentId: true, operatingYear: true, sourceYear: true, sourceEnrollmentId: true, openingAmount: true, existingCredits: true, sourceReferencesJson: true, provenance: true, status: true, version: true, preparerId: true, verifierId: true } }));
    const previews = [];
    for (const liability of liabilities) {
      try {
        const balance = await priorYearBalance(prisma, liability.id);
        previews.push({ liabilityId: liability.id, status: "VERIFIED", balanceHash: balance.hash, balanceVersion: balance.liability.version, opening: balance.totals.opening.toFixed(2), payments: balance.totals.payments.toFixed(2), existingCredits: balance.totals.existingCredits.toFixed(2), appliedRelief: balance.totals.appliedRelief.toFixed(2), reversals: balance.totals.reversals.toFixed(2), remaining: balance.totals.remaining.toFixed(2) });
      } catch { previews.push({ liabilityId: liability.id, status: "REVIEW_REQUIRED" }); }
    }
    const history = id ? await prisma.priorYearConcessionEvent.findMany({ where: { OR: [{ caseId: id }, { caseId: null, liabilityId: cases.find((item) => item.id === id)?.liabilityId ?? "" }] }, orderBy: { createdAt: "asc" }, take: 250, select: { id: true, eventType: true, previousState: true, newState: true, actorId: true, amount: true, reason: true, reversesEventId: true, createdAt: true } }) : [];
    let currentYearFees: { status: string; annual?: string; paid?: string; remaining?: string } = { status: "SELECT_CASE" };
    const selected = cases.find((item) => item.id === id);
    if (selected) {
      try {
        await authorizePriorYear(prisma, actor, "VIEW_LEDGER");
        const student = await prisma.student.findUniqueOrThrow({ where: { id: selected.liability.studentId } });
        if (student.academicYear !== selected.liability.operatingYear) throw new Error("CURRENT_ENROLLMENT_REVIEW_REQUIRED");
        const fee = await prisma.feeStructure.findUniqueOrThrow({ where: { academicYear_className: { academicYear: student.academicYear, className: student.className } } });
        const payments = await prisma.payment.findMany({ where: { studentId: student.id, deletedAt: null } });
        const allocation = allocateFees(student, fee, await effectiveActiveSelectedReceiptPayments(prisma, payments));
        currentYearFees = { status: "EXISTING_LEDGER_UNCHANGED", annual: allocation.annualFeeAfterDiscount.toFixed(2), paid: allocation.totalCurrentYearPaid.toFixed(2), remaining: allocation.totalPending.toFixed(2) };
      } catch { currentYearFees = { status: "LEDGER_ACCESS_OR_CONFIGURATION_REQUIRED" }; }
    }
    return NextResponse.json({ cases, liabilities, previews, history, selectedCaseId: id, page, hasMore: cases.length >= 50 || liabilities.length >= 100, incomeBands: policy.incomeBands, currentYearFees }, { headers });
  } catch { return NextResponse.json({ error: "Previous-year cases are unavailable for this access context." }, { status: 403, headers }); }
}

export async function POST(request: NextRequest) {
  const off = requireOperationalReleaseFeatureForApi(PRIOR_YEAR_CONCESSIONS_FEATURE); if (off) return off;
  const context = await getCurrentAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  const actor = { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId };
  try {
    const bytes = await request.text();
    if (Buffer.byteLength(bytes, "utf8") > 32768) return NextResponse.json({ error: "Request is too large" }, { status: 413, headers });
    const input = JSON.parse(bytes);
    if (input.action === "PREVIEW_SOURCE") {
      await authorizePriorYear(prisma, actor, "PREPARE_PRIOR_YEAR_CONCESSIONS");
      if (!Array.isArray(input.rows) || input.rows.length > 100) throw new Error("SOURCE_PREVIEW_LIMIT");
      return NextResponse.json({ proposals: input.rows.map((row: unknown, index: number) => ({ row: index + 1, status: sourceProposalStatus((row ?? {}) as Parameters<typeof sourceProposalStatus>[0]) })), authoritativeWrites: 0 }, { headers });
    }
    return NextResponse.json(await mutatePriorYear(prisma, actor, input), { headers });
  } catch (error) {
    // Domain codes contain no income, Student identity or database error details.
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{3,100}$/.test(error.message) ? error.message : "CONCESSION_REQUEST_REQUIRES_REVIEW";
    return NextResponse.json({ error: code }, { status: code.includes("PERMISSION") ? 403 : 409, headers });
  }
}
