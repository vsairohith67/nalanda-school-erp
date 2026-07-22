import { deriveOverdue } from "@/lib/library-circulation";

export function publicLibraryMember(member: any) {
  return {
    memberCode: member.memberCode,
    memberType: member.memberType,
    status: member.status,
    joinedDate: member.joinedDate,
    borrower: member.student
      ? { name: member.student.studentName, code: member.student.admissionNo, className: member.student.className, section: member.student.section }
      : member.staffMember
        ? { name: member.staffMember.fullName, code: member.staffMember.staffCode, staffType: member.staffMember.staffType, designation: member.staffMember.designation }
        : null,
    activeLoanCount: member._count?.loans,
  };
}

export function publicLibraryPolicy(policy: any) {
  return {
    policyCode: policy.policyCode,
    name: policy.name,
    memberType: policy.memberType,
    className: policy.className,
    staffType: policy.staffType,
    maxActiveLoans: policy.maxActiveLoans,
    loanPeriodDays: policy.loanPeriodDays,
    maxRenewals: policy.maxRenewals,
    renewalPeriodDays: policy.renewalPeriodDays,
    reservationLimit: policy.reservationLimit,
    status: policy.status,
    priority: policy.priority,
    notes: policy.notes,
  };
}

export function publicLibraryEvent(event: any) {
  return {
    eventType: event.eventType,
    eventDate: event.eventDate,
    previousDueDate: event.previousDueDate,
    newDueDate: event.newDueDate,
    reason: event.reason,
    notes: event.notes,
    recordedBy: event.recordedBy?.name ?? "System",
  };
}

export function publicLibraryLoan(loan: any) {
  return {
    loanNumber: loan.loanNumber,
    status: loan.status,
    issueDate: loan.issueDate,
    dueDate: loan.dueDate,
    returnedDate: loan.returnedDate,
    renewCount: loan.renewCount,
    policyCodeSnapshot: loan.policyCodeSnapshot,
    loanPeriodDaysSnapshot: loan.loanPeriodDaysSnapshot,
    maxRenewalsSnapshot: loan.maxRenewalsSnapshot,
    renewalPeriodDaysSnapshot: loan.renewalPeriodDaysSnapshot,
    issueConditionSnapshot: loan.issueConditionSnapshot,
    returnConditionSnapshot: loan.returnConditionSnapshot,
    issueNotes: loan.issueNotes,
    returnNotes: loan.returnNotes,
    cancellationReason: loan.cancellationReason,
    borrower: loan.member ? publicLibraryMember(loan.member) : undefined,
    copy: loan.copy ? { accessionNumber: loan.copy.accessionNumber, condition: loan.copy.condition, physicalStatus: loan.copy.status, titleCode: loan.copy.title?.titleCode, title: loan.copy.title?.title } : undefined,
    fulfilledReservationNumber: loan.fulfilledReservation?.reservationNumber,
    events: loan.events?.map(publicLibraryEvent),
    ...deriveOverdue(loan),
  };
}

export function publicLibraryReservation(reservation: any) {
  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    requestedDate: reservation.requestedDate,
    expiresDate: reservation.expiresDate,
    fulfilledAt: reservation.fulfilledAt,
    cancelledAt: reservation.cancelledAt,
    cancellationReason: reservation.cancellationReason,
    member: reservation.member ? publicLibraryMember(reservation.member) : undefined,
    title: reservation.title ? { titleCode: reservation.title.titleCode, title: reservation.title.title } : undefined,
    fulfilledLoanNumber: reservation.fulfilledLoan?.loanNumber,
  };
}
