import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { parseLibraryDate } from "@/lib/library-members";

export const INCIDENT_TYPES = ["LOST", "DAMAGED"] as const;
export const INCIDENT_RESOLUTIONS = ["ITEM_RETURNED", "REPAIRED_AVAILABLE", "REPLACEMENT_ACCEPTED", "CHARGE_PAID", "FULLY_WAIVED", "PARTIALLY_WAIVED_AND_PAID", "WRITTEN_OFF"] as const;

function incidentNumber(date: Date) { return `INC-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`; }
function requiredText(value: unknown, label: string, max = 2000) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required`); if (text.length > max) throw new Error(`${label} must be at most ${max} characters`); return text; }

export async function createLibraryIncident(client: PrismaClient, input: Record<string, unknown>, actorUserId: string) {
  const incidentType = String(input.incidentType ?? "").toUpperCase();
  if (!INCIDENT_TYPES.includes(incidentType as never)) throw new Error("Incident type must be LOST or DAMAGED");
  const reportedDate = parseLibraryDate(input.reportedDate, "Reported date");
  const description = requiredText(input.description, "Description");
  const incidentCondition = String(input.incidentCondition ?? "").trim().toUpperCase() || null;
  if (incidentType === "DAMAGED" && !incidentCondition) throw new Error("Damage condition is required");
  if (incidentType === "DAMAGED" && !["POOR", "DAMAGED"].includes(incidentCondition!)) throw new Error("Damage condition must be POOR or DAMAGED");
  const submit = String(input.action ?? "save").toLowerCase() === "submit";
  try {
    return await client.$transaction(async (tx) => {
      const loan = await tx.libraryLoan.findUnique({ where: { id: String(input.loanId ?? "") }, include: { copy: true, member: true } });
      if (!loan) throw new Error("Library loan not found");
      if (incidentType === "LOST" && loan.status !== "ISSUED") throw new Error("A LOST incident requires an active issued loan");
      if (incidentType === "DAMAGED" && !["ISSUED", "RETURNED"].includes(loan.status)) throw new Error("A DAMAGED incident requires an issued or returned loan");
      if (reportedDate < loan.issueDate) throw new Error("Incident reported date cannot be before the loan issue date");
      if (loan.copyId !== loan.copy.id || loan.memberId !== loan.member.id) throw new Error("Loan links are inconsistent");
      if (loan.copy.status === "WITHDRAWN") throw new Error("A withdrawn copy cannot receive a new incident");
      const activeCaseKey = `${loan.id}:${loan.copyId}`;
      const status = submit ? "PENDING_REVIEW" : "DRAFT";
      const incident = await tx.libraryIncident.create({ data: { incidentNumber: incidentNumber(reportedDate), incidentType, status, activeCaseKey, loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, reportedDate, incidentCondition, description, assessmentNotes: String(input.assessmentNotes ?? "").trim() || null, createdByUserId: actorUserId, submittedByUserId: submit ? actorUserId : null, submittedAt: submit ? new Date() : null } });
      const nextStatus = incidentType === "LOST" ? "MISSING" : "UNDER_REPAIR";
      const nextCondition = incidentType === "DAMAGED" ? "DAMAGED" : loan.copy.condition;
      await tx.libraryCopy.update({ where: { id: loan.copyId }, data: { status: nextStatus, condition: nextCondition, updatedByUserId: actorUserId } });
      await tx.libraryCopyEvent.create({ data: { copyId: loan.copyId, eventType: incidentType === "LOST" ? "MARKED_MISSING" : "SENT_FOR_REPAIR", eventDate: reportedDate, previousStatus: loan.copy.status, newStatus: nextStatus, previousCondition: loan.copy.condition, newCondition: nextCondition, reason: `${incident.incidentNumber}: ${description}`, recordedByUserId: actorUserId } });
      await tx.libraryLoanEvent.create({ data: { loanId: loan.id, memberId: loan.memberId, copyId: loan.copyId, titleId: loan.copy.titleId, eventType: incidentType === "LOST" ? "LOST_REPORTED" : "DAMAGE_REPORTED", eventDate: reportedDate, reason: incident.incidentNumber, notes: description, recordedByUserId: actorUserId } });
      await tx.libraryChargeEvent.create({ data: { incidentId: incident.id, eventType: submit ? "INCIDENT_SUBMITTED" : "INCIDENT_CREATED", eventDate: new Date(), newStatus: status, reason: description, recordedByUserId: actorUserId } });
      return incident;
    });
  } catch (error: any) { if (error?.code === "P2002") throw new Error("An active unresolved incident already exists for this loan and copy"); throw error; }
}

export async function incidentWorkflow(client: PrismaClient, id: string, action: "submit" | "approve" | "cancel", reason: unknown, actorUserId: string) {
  return client.$transaction(async (tx) => {
    const row = await tx.libraryIncident.findUnique({ where: { id } }); if (!row) throw new Error("Library incident not found");
    if (["RESOLVED", "CANCELLED"].includes(row.status)) throw new Error("Resolved or cancelled incidents are immutable");
    const now = new Date();
    if (action === "submit") {
      if (row.status !== "DRAFT") throw new Error("Only a draft incident can be submitted");
      const changed = await tx.libraryIncident.updateMany({ where: { id, status: "DRAFT" }, data: { status: "PENDING_REVIEW", submittedByUserId: actorUserId, submittedAt: now } }); if (changed.count !== 1) throw new Error("Incident changed during submission");
      await tx.libraryChargeEvent.create({ data: { incidentId: id, eventType: "INCIDENT_SUBMITTED", eventDate: now, previousStatus: "DRAFT", newStatus: "PENDING_REVIEW", recordedByUserId: actorUserId } });
    } else if (action === "approve") {
      if (row.status !== "PENDING_REVIEW") throw new Error("Only a pending incident can be approved");
      const changed = await tx.libraryIncident.updateMany({ where: { id, status: "PENDING_REVIEW" }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: now } }); if (changed.count !== 1) throw new Error("Incident changed during approval");
      await tx.libraryChargeEvent.create({ data: { incidentId: id, eventType: "INCIDENT_APPROVED", eventDate: now, previousStatus: "PENDING_REVIEW", newStatus: "APPROVED", recordedByUserId: actorUserId } });
    } else {
      const cancellationReason = requiredText(reason, "Cancellation reason", 1000);
      const changed = await tx.libraryIncident.updateMany({ where: { id, status: row.status, activeCaseKey: row.activeCaseKey }, data: { status: "CANCELLED", activeCaseKey: null, cancellationReason, cancelledByUserId: actorUserId, cancelledAt: now } }); if (changed.count !== 1) throw new Error("Incident changed during cancellation");
      await tx.libraryChargeEvent.create({ data: { incidentId: id, eventType: "INCIDENT_CANCELLED", eventDate: now, previousStatus: row.status, newStatus: "CANCELLED", reason: cancellationReason, recordedByUserId: actorUserId } });
    }
    return tx.libraryIncident.findUniqueOrThrow({ where: { id } });
  });
}

export async function resolveLibraryIncident(client: PrismaClient, id: string, input: Record<string, unknown>, actorUserId: string) {
  const resolutionType = String(input.resolutionType ?? "").toUpperCase();
  if (!INCIDENT_RESOLUTIONS.includes(resolutionType as never)) throw new Error("Unsupported incident resolution");
  const resolutionNotes = requiredText(input.resolutionNotes, "Resolution notes", 2000);
  const resolvedDate = parseLibraryDate(input.resolvedDate ?? schoolDateKey(), "Resolved date");
  return client.$transaction(async (tx) => {
    const row = await tx.libraryIncident.findUnique({ where: { id }, include: { loan: true, copy: true, charges: true } });
    if (!row || row.status !== "APPROVED" || !row.activeCaseKey) throw new Error("Only an approved open incident can be resolved");
    let replacementCopyId: string | null = null;
    if (resolutionType === "REPLACEMENT_ACCEPTED") {
      replacementCopyId = String(input.replacementCopyId ?? ""); const replacement = await tx.libraryCopy.findUnique({ where: { id: replacementCopyId } });
      if (!replacement || replacement.id === row.copyId || replacement.status !== "AVAILABLE") throw new Error("Select a different available accessioned replacement copy");
    }
    const matchingCharge = row.charges.find((charge) => resolutionType === "CHARGE_PAID" ? charge.status === "PAID" : resolutionType === "FULLY_WAIVED" ? charge.status === "WAIVED" : resolutionType === "PARTIALLY_WAIVED_AND_PAID" ? charge.status === "PAID" && charge.waivedAmount.gt(0) : true);
    if (["CHARGE_PAID", "FULLY_WAIVED", "PARTIALLY_WAIVED_AND_PAID"].includes(resolutionType) && !matchingCharge) throw new Error("The linked charge does not support the selected financial resolution");
    if (resolutionType === "ITEM_RETURNED") {
      if (row.incidentType !== "LOST" || row.loan.status !== "ISSUED" || !row.loan.activeCopyKey) throw new Error("Original-item return requires an active LOST loan");
      const condition = String(input.returnCondition ?? "GOOD").toUpperCase(); if (!['NEW','GOOD','FAIR','POOR','DAMAGED'].includes(condition)) throw new Error("Unsupported return condition");
      const changedLoan = await tx.libraryLoan.updateMany({ where: { id: row.loanId, status: "ISSUED", activeCopyKey: row.copyId }, data: { status: "RETURNED", activeCopyKey: null, returnedDate: resolvedDate, returnConditionSnapshot: condition, returnNotes: resolutionNotes, returnedByUserId: actorUserId } }); if (changedLoan.count !== 1) throw new Error("Loan changed during original-item return");
      await tx.libraryLoanEvent.create({ data: { loanId: row.loanId, memberId: row.memberId, copyId: row.copyId, titleId: row.titleId, eventType: "RETURNED", eventDate: resolvedDate, reason: `Original item returned for ${row.incidentNumber}`, notes: resolutionNotes, recordedByUserId: actorUserId } });
      await tx.libraryCopy.update({ where: { id: row.copyId }, data: { status: condition === "DAMAGED" ? "UNDER_REPAIR" : "AVAILABLE", condition, updatedByUserId: actorUserId } });
      await tx.libraryCopyEvent.create({ data: { copyId: row.copyId, eventType: condition === "DAMAGED" ? "SENT_FOR_REPAIR" : "RETURNED_FROM_REPAIR", eventDate: resolvedDate, previousStatus: row.copy.status, newStatus: condition === "DAMAGED" ? "UNDER_REPAIR" : "AVAILABLE", previousCondition: row.copy.condition, newCondition: condition, reason: row.incidentNumber, notes: resolutionNotes, recordedByUserId: actorUserId } });
    } else if (resolutionType === "REPAIRED_AVAILABLE") {
      if (row.incidentType !== "DAMAGED" || row.copy.status !== "UNDER_REPAIR") throw new Error("Only an under-repair damaged copy can be restored to availability");
      const repairedCondition = String(input.returnCondition ?? "GOOD").toUpperCase();
      if (!["NEW", "GOOD", "FAIR", "POOR"].includes(repairedCondition)) throw new Error("A repaired available copy must use NEW, GOOD, FAIR, or POOR condition");
      await tx.libraryCopy.update({ where: { id: row.copyId }, data: { status: "AVAILABLE", condition: repairedCondition, updatedByUserId: actorUserId } });
      await tx.libraryCopyEvent.create({ data: { copyId: row.copyId, eventType: "RETURNED_FROM_REPAIR", eventDate: resolvedDate, previousStatus: row.copy.status, newStatus: "AVAILABLE", previousCondition: row.copy.condition, newCondition: repairedCondition, reason: row.incidentNumber, notes: resolutionNotes, recordedByUserId: actorUserId } });
    }
    const changed = await tx.libraryIncident.updateMany({ where: { id, status: "APPROVED", activeCaseKey: row.activeCaseKey }, data: { status: "RESOLVED", activeCaseKey: null, resolutionType, replacementCopyId, resolvedDate, resolutionNotes, resolvedByUserId: actorUserId, resolvedAt: new Date() } }); if (changed.count !== 1) throw new Error("Incident changed during resolution");
    await tx.libraryChargeEvent.create({ data: { incidentId: id, eventType: "INCIDENT_RESOLVED", eventDate: new Date(), previousStatus: "APPROVED", newStatus: "RESOLVED", reason: resolutionType, notes: resolutionNotes, recordedByUserId: actorUserId } });
    return tx.libraryIncident.findUniqueOrThrow({ where: { id } });
  });
}
