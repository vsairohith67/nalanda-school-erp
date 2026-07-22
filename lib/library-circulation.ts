import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { effectiveMemberStatus, parseLibraryDate } from "@/lib/library-members";
import { resolveLibraryPolicy } from "@/lib/library-policies";

type CirculationClient = PrismaClient;
export const RETURN_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

export function addCalendarDays(date: Date, days: number) {
  const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result;
}

export function deriveOverdue(loan: { status: string; dueDate: Date }, now = new Date()) {
  if (loan.status !== "ISSUED") return { overdue: false, overdueDays: 0 };
  const today = parseLibraryDate(schoolDateKey(now));
  const due = parseLibraryDate(schoolDateKey(loan.dueDate));
  return { overdue: due < today, overdueDays: Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000)) };
}

function number(prefix: string, date: Date) {
  return `${prefix}-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function assertEligibleMember(member: any, now: Date) {
  if (effectiveMemberStatus(member, now) !== "ACTIVE") throw new Error("This library membership is not currently eligible to borrow or renew");
  if (member.memberType === "STUDENT" && (!member.student || member.student.deletedAt || member.student.status.trim().toUpperCase() !== "ACTIVE")) throw new Error("The linked Student is not active");
  if (member.memberType === "STAFF" && (!member.staffMember || member.staffMember.status.trim().toUpperCase() !== "ACTIVE")) throw new Error("The linked StaffMember is not active");
}

export async function previewLibraryIssue(client: CirculationClient | Prisma.TransactionClient, memberId: string, copyId: string, issueDateInput: unknown) {
  const issueDate = parseLibraryDate(issueDateInput, "Issue date");
  const [member, copy] = await Promise.all([
    client.libraryMember.findUnique({ where: { id: memberId }, include: { student: { select: { status: true, deletedAt: true } }, staffMember: { select: { status: true } }, _count: { select: { loans: { where: { status: "ISSUED" } } } } } }),
    client.libraryCopy.findUnique({ where: { id: copyId }, include: { title: true, loans: { where: { status: "ISSUED" }, select: { id: true } } } })
  ]);
  if (!member) throw new Error("Library member not found"); if (!copy) throw new Error("Library copy not found");
  assertEligibleMember(member, issueDate);
  if (copy.status !== "AVAILABLE") throw new Error(`Copy physical status is ${copy.status}; correct it before issue`);
  if (copy.loans.length) throw new Error("This copy already has an active loan");
  const resolved = await resolveLibraryPolicy(client as any, member.id);
  if (member._count.loans >= resolved.policy.maxActiveLoans) throw new Error(`Member has reached the ${resolved.policy.maxActiveLoans}-loan limit`);
  const queue = await client.libraryReservation.findMany({ where: { titleId: copy.titleId, status: "WAITING", OR: [{ expiresDate: null }, { expiresDate: { gte: issueDate } }] }, orderBy: [{ requestedDate: "asc" }, { createdAt: "asc" }], select: { id: true, memberId: true, reservationNumber: true } });
  if (queue[0] && queue[0].memberId !== member.id) throw new Error(`Reservation priority belongs to ${queue[0].reservationNumber}; issue to that waiting member first`);
  return { member, copy, policy: resolved.policy, policyScope: resolved.scopeLabel, dueDate: addCalendarDays(issueDate, resolved.policy.loanPeriodDays), priorityReservation: queue[0] ?? null };
}

export async function issueLibraryBook(client: CirculationClient, input: Record<string, unknown>, actorUserId: string) {
  try {
    return await client.$transaction(async (tx) => {
      const issueDate = parseLibraryDate(input.issueDate, "Issue date");
      const preview = await previewLibraryIssue(tx, String(input.memberId ?? ""), String(input.copyId ?? ""), schoolDateKey(issueDate));
      const loan = await tx.libraryLoan.create({ data: {
        loanNumber: number("LN", issueDate), copyId: preview.copy.id, memberId: preview.member.id, status: "ISSUED", activeCopyKey: preview.copy.id,
        issueDate, dueDate: preview.dueDate, policyCodeSnapshot: preview.policy.policyCode, loanPeriodDaysSnapshot: preview.policy.loanPeriodDays,
        maxRenewalsSnapshot: preview.policy.maxRenewals, renewalPeriodDaysSnapshot: preview.policy.renewalPeriodDays,
        issueConditionSnapshot: preview.copy.condition, issueNotes: String(input.issueNotes ?? "").trim() || null, issuedByUserId: actorUserId
      } });
      await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: preview.copy.titleId, eventType: "ISSUED", eventDate: issueDate, newDueDate: loan.dueDate, recordedByUserId: actorUserId } });
      if (preview.priorityReservation) {
        const changed = await tx.libraryReservation.updateMany({ where: { id: preview.priorityReservation.id, status: "WAITING", activeMemberTitleKey: `${preview.member.id}:${preview.copy.titleId}` }, data: { status: "FULFILLED", activeMemberTitleKey: null, fulfilledLoanId: loan.id, fulfilledAt: issueDate, fulfilledByUserId: actorUserId } });
        if (changed.count !== 1) throw new Error("Reservation queue changed during issue; review and try again");
        await tx.libraryLoanEvent.create({ data: { loanId: loan.id, reservationId: preview.priorityReservation.id, memberId: loan.memberId, copyId: loan.copyId, titleId: preview.copy.titleId, eventType: "RESERVATION_FULFILLED", eventDate: issueDate, recordedByUserId: actorUserId } });
      }
      return loan;
    }, { maxWait: 5_000, timeout: 15_000 });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error("This copy, loan number, or reservation was claimed by another operation; refresh and try again");
    throw error;
  }
}

export async function returnLibraryBook(client: CirculationClient, input: Record<string, unknown>, actorUserId: string) {
  const loanId = String(input.loanId ?? ""); const returnedDate = parseLibraryDate(input.returnedDate, "Return date");
  const condition = String(input.returnCondition ?? "").toUpperCase(); if (!RETURN_CONDITIONS.includes(condition as never)) throw new Error("Unsupported return condition");
  return client.$transaction(async (tx) => {
    const loan = await tx.libraryLoan.findUnique({ where: { id: loanId }, include: { copy: true } });
    if (!loan || loan.status !== "ISSUED" || !loan.activeCopyKey) throw new Error("Only an active issued loan can be returned");
    if (returnedDate < loan.issueDate) throw new Error("Return date cannot be before issue date");
    if (loan.copy.status !== "AVAILABLE") throw new Error(`Copy physical status is ${loan.copy.status}; correct the physical-status conflict before return`);
    const changed = await tx.libraryLoan.updateMany({ where: { id: loan.id, status: "ISSUED", activeCopyKey: loan.copyId }, data: { status: "RETURNED", activeCopyKey: null, returnedDate, returnConditionSnapshot: condition, returnNotes: String(input.returnNotes ?? "").trim() || null, returnedByUserId: actorUserId } });
    if (changed.count !== 1) throw new Error("This loan was already returned or changed by another operation");
    await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, eventType: "RETURNED", eventDate: returnedDate, reason: condition === "DAMAGED" ? "Damaged condition recorded; financial workflow is future work" : null, notes: String(input.returnNotes ?? "").trim() || null, recordedByUserId: actorUserId } });
    if (condition === "DAMAGED" && String(input.reportDamage ?? "").toLowerCase() === "yes") {
      const description = String(input.damageDescription ?? input.returnNotes ?? "").trim(); if (!description) throw new Error("Damage description is required when reporting damage during return");
      const incident = await tx.libraryIncident.create({ data: { incidentNumber: number("INC", returnedDate), incidentType: "DAMAGED", status: "PENDING_REVIEW", activeCaseKey: `${loan.id}:${loan.copyId}`, loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, reportedDate: returnedDate, incidentCondition: "DAMAGED", description, createdByUserId: actorUserId, submittedByUserId: actorUserId, submittedAt: new Date() } });
      await tx.libraryCopy.update({ where: { id: loan.copyId }, data: { condition: "DAMAGED", status: "UNDER_REPAIR", updatedByUserId: actorUserId } });
      await tx.libraryCopyEvent.create({ data: { copyId: loan.copyId, eventType: "SENT_FOR_REPAIR", eventDate: returnedDate, previousStatus: loan.copy.status, newStatus: "UNDER_REPAIR", previousCondition: loan.copy.condition, newCondition: "DAMAGED", reason: incident.incidentNumber, notes: description, recordedByUserId: actorUserId } });
      await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, eventType: "DAMAGE_REPORTED", eventDate: returnedDate, reason: incident.incidentNumber, notes: description, recordedByUserId: actorUserId } });
      await tx.libraryChargeEvent.create({ data: { incidentId: incident.id, eventType: "INCIDENT_SUBMITTED", eventDate: new Date(), newStatus: "PENDING_REVIEW", reason: description, recordedByUserId: actorUserId } });
    }
    return tx.libraryLoan.findUniqueOrThrow({ where: { id: loan.id } });
  });
}

export async function renewLibraryLoan(client: CirculationClient, loanId: string, actorUserId: string, eventDate = new Date()) {
  return client.$transaction(async (tx) => {
    const loan = await tx.libraryLoan.findUnique({ where: { id: loanId }, include: { member: { include: { student: { select: { status: true, deletedAt: true } }, staffMember: { select: { status: true } } } }, copy: true } });
    if (!loan || loan.status !== "ISSUED") throw new Error("Only an active issued loan can be renewed");
    assertEligibleMember(loan.member, eventDate);
    if (loan.renewCount >= loan.maxRenewalsSnapshot) throw new Error("This loan has reached its renewal limit");
    const blocking = await tx.libraryReservation.findFirst({ where: { titleId: loan.copy.titleId, status: "WAITING", memberId: { not: loan.memberId }, OR: [{ expiresDate: null }, { expiresDate: { gte: parseLibraryDate(schoolDateKey(eventDate)) } }] } });
    if (blocking) throw new Error("Renewal is blocked because another member is waiting for this title");
    const newDueDate = addCalendarDays(loan.dueDate, loan.renewalPeriodDaysSnapshot);
    const changed = await tx.libraryLoan.updateMany({ where: { id: loan.id, status: "ISSUED", renewCount: loan.renewCount, dueDate: loan.dueDate }, data: { dueDate: newDueDate, renewCount: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("This loan changed during renewal; refresh and try again");
    await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, eventType: "RENEWED", eventDate, previousDueDate: loan.dueDate, newDueDate, notes: "Renewed using the original loan policy snapshot", recordedByUserId: actorUserId } });
    return tx.libraryLoan.findUniqueOrThrow({ where: { id: loan.id } });
  });
}

export async function cancelLibraryLoan(client: CirculationClient, loanId: string, reason: string, actorUserId: string) {
  if (!reason.trim()) throw new Error("Cancellation reason is required");
  return client.$transaction(async (tx) => {
    const loan = await tx.libraryLoan.findUnique({ where: { id: loanId }, include: { copy: true } });
    if (!loan || loan.status !== "ISSUED") throw new Error("Only an active issued loan can be cancelled as an issue correction");
    const changed = await tx.libraryLoan.updateMany({ where: { id: loan.id, status: "ISSUED", activeCopyKey: loan.copyId }, data: { status: "CANCELLED", activeCopyKey: null, cancellationReason: reason.trim(), cancelledByUserId: actorUserId } });
    if (changed.count !== 1) throw new Error("This loan changed before cancellation; refresh and try again");
    await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, eventType: "LOAN_CANCELLED", eventDate: new Date(), reason: reason.trim(), recordedByUserId: actorUserId } });
    return tx.libraryLoan.findUniqueOrThrow({ where: { id: loan.id } });
  });
}
