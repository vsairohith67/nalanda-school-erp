import { safeMemberLabel } from "@/lib/library-members";

export const incidentInclude = {
  member: { include: { student: { select: { studentName: true, admissionNo: true, className: true, section: true } }, staffMember: { select: { fullName: true, staffCode: true, staffType: true, designation: true } } } },
  loan: { select: { id: true, loanNumber: true, status: true, issueDate: true, dueDate: true, returnedDate: true } },
  copy: { select: { id: true, accessionNumber: true, status: true, condition: true } },
  title: { select: { titleCode: true, title: true } }, replacementCopy: { select: { accessionNumber: true } },
  charges: { select: { id: true, chargeNumber: true, chargeType: true, status: true, originalAmount: true, waivedAmount: true, payableAmount: true } },
  events: { include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } }
};
export const chargeInclude = {
  member: { include: { student: { select: { studentName: true, admissionNo: true, className: true, section: true } }, staffMember: { select: { fullName: true, staffCode: true, staffType: true, designation: true } } } },
  loan: { select: { id: true, loanNumber: true, status: true, issueDate: true, dueDate: true, returnedDate: true } },
  incident: { select: { id: true, incidentNumber: true, incidentType: true, status: true } },
  miscIncomeReceipt: { select: { id: true, receiptNumber: true, receiptDate: true, status: true, netAmount: true } },
  events: { include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } }
};

export function publicIncident(row: any, masked = false) {
  return {
    id: masked ? undefined : row.id, incidentNumber: row.incidentNumber, incidentType: row.incidentType, status: row.status,
    borrower: safeMemberLabel(row.member, masked), memberType: row.member.memberType,
    loan: { id: masked ? undefined : row.loan.id, loanNumber: row.loan.loanNumber, status: row.loan.status, issueDate: row.loan.issueDate, dueDate: row.loan.dueDate, returnedDate: row.loan.returnedDate },
    copy: { id: masked ? undefined : row.copy.id, accessionNumber: row.copy.accessionNumber, status: row.copy.status, condition: row.copy.condition },
    title: row.title, reportedDate: row.reportedDate, incidentCondition: row.incidentCondition, description: row.description,
    assessmentNotes: masked ? undefined : row.assessmentNotes, resolutionType: row.resolutionType, replacementAccession: row.replacementCopy?.accessionNumber ?? null,
    resolvedDate: row.resolvedDate, resolutionNotes: masked ? undefined : row.resolutionNotes, cancellationReason: masked ? undefined : row.cancellationReason,
    charges: row.charges?.map((charge: any) => ({ id: masked ? undefined : charge.id, chargeNumber: charge.chargeNumber, type: charge.chargeType, status: charge.status, originalAmount: charge.originalAmount.toFixed(2), waivedAmount: charge.waivedAmount.toFixed(2), payableAmount: charge.payableAmount.toFixed(2) })),
    events: row.events?.map((event: any) => ({ eventType: event.eventType, eventDate: event.eventDate, previousStatus: event.previousStatus, newStatus: event.newStatus, amount: event.amountSnapshot?.toFixed(2) ?? null, reason: masked ? undefined : event.reason, notes: masked ? undefined : event.notes, actorLabel: masked ? "Authorized staff" : event.recordedBy?.name ?? "System / restored record" }))
  };
}

export function publicCharge(row: any, masked = false) {
  return {
    id: masked ? undefined : row.id, chargeNumber: row.chargeNumber, chargeType: row.chargeType, status: row.status,
    borrower: safeMemberLabel(row.member, masked), memberType: row.member.memberType,
    loan: row.loan ? { id: masked ? undefined : row.loan.id, loanNumber: row.loan.loanNumber, status: row.loan.status, dueDate: row.loan.dueDate } : null,
    incident: row.incident ? { id: masked ? undefined : row.incident.id, incidentNumber: row.incident.incidentNumber, type: row.incident.incidentType, status: row.incident.status } : null,
    assessedDate: row.assessedDate, dueDate: row.dueDate, overdueDaysSnapshot: row.overdueDaysSnapshot,
    ruleCodeSnapshot: masked ? undefined : row.ruleCodeSnapshot, rateSnapshot: masked ? undefined : row.rateSnapshot?.toFixed(2) ?? null,
    originalAmount: row.originalAmount.toFixed(2), waivedAmount: row.waivedAmount.toFixed(2), payableAmount: row.payableAmount.toFixed(2),
    assessmentReason: masked ? undefined : row.assessmentReason, waiverReason: masked ? undefined : row.waiverReason, cancellationReason: masked ? undefined : row.cancellationReason,
    receipt: row.miscIncomeReceipt ? { id: masked ? undefined : row.miscIncomeReceipt.id, receiptNumber: row.miscIncomeReceipt.receiptNumber, receiptDate: row.miscIncomeReceipt.receiptDate, status: row.miscIncomeReceipt.status, amount: row.miscIncomeReceipt.netAmount.toFixed(2), warning: row.miscIncomeReceipt.status === "CANCELLED" ? "Linked receipt cancelled; compensating correction required" : null } : null,
    events: row.events?.map((event: any) => ({ eventType: event.eventType, eventDate: event.eventDate, previousStatus: event.previousStatus, newStatus: event.newStatus, amount: event.amountSnapshot?.toFixed(2) ?? null, reason: masked ? undefined : event.reason, notes: masked ? undefined : event.notes, actorLabel: masked ? "Authorized staff" : event.recordedBy?.name ?? "System / restored record" }))
  };
}
