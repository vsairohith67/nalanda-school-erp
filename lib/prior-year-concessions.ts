import { randomUUID } from "node:crypto";
import { authHashSecret } from "@/lib/auth-security";
import { Prisma, type PrismaClient } from "@prisma/client";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { consumeStepUpGrant } from "@/lib/real-user-access/step-up";
import { decryptMfaSecret, encryptMfaSecret } from "@/lib/real-user-access/crypto";
import { assertOperationalReleaseFeature, PRIOR_YEAR_CONCESSIONS_FEATURE } from "@/lib/release-feature-flag-runtime";
import { localDate } from "@/lib/expenses";
import { effectiveActiveSelectedReceiptPayments, loadReceiptStateMap } from "@/lib/receipt-integrity";
import { approvalSeparation, assertPriorYearTransition, concessionBalanceHash, eligiblePreviousYear, normalizeIncomeSupport, priorYearAmount, priorYearText, reconcilePriorYear, sumPriorYearAmounts, validatePriorYearPolicy, type PriorYearPolicy, type PriorYearState } from "@/lib/prior-year-concession-policy";

export type ConcessionActor = { userId: string; sessionId: string; roleAssignmentId: string };
type Tx = Prisma.TransactionClient;
type RecordInput = Record<string, unknown>;
type Context = { policy?: PriorYearPolicy };
const deniedRoles = new Set(["TEACHER", "PARENT", "STUDENT", "VIEWER", "GATE_STAFF"]);
const terminalPrivilege = new Set(["VERIFY", "VERIFY_PAYMENT", "APPROVE", "APPLY", "REVERSE", "REVIEW_REVERSAL", "PURGE_INCOME"]);
const permissions: Record<string, string> = {
  PREPARE_LIABILITY: "PREPARE_PRIOR_YEAR_CONCESSIONS", VERIFY: "VERIFY_PRIOR_YEAR_LIABILITIES",
  PREPARE: "PREPARE_PRIOR_YEAR_CONCESSIONS", SUBMIT: "PREPARE_PRIOR_YEAR_CONCESSIONS",
  REVIEW: "REVIEW_PRIOR_YEAR_CONCESSIONS", RETURN: "REVIEW_PRIOR_YEAR_CONCESSIONS", REJECT: "REVIEW_PRIOR_YEAR_CONCESSIONS",
  APPROVE: "APPROVE_PRIOR_YEAR_CONCESSIONS", APPLY: "APPLY_PRIOR_YEAR_CONCESSIONS", EXPIRE: "APPLY_PRIOR_YEAR_CONCESSIONS",
  REVERSE: "REVERSE_PRIOR_YEAR_CONCESSIONS", INCOME: "MANAGE_PRIOR_YEAR_INCOME"
  , AMEND: "PREPARE_PRIOR_YEAR_CONCESSIONS", PROPOSE_PAYMENT: "PREPARE_PRIOR_YEAR_CONCESSIONS", VERIFY_PAYMENT: "VERIFY_PRIOR_YEAR_LIABILITIES", PURGE_INCOME: "MANAGE_PRIOR_YEAR_INCOME"
  , REVIEW_REVERSAL: "REVERSE_PRIOR_YEAR_CONCESSIONS"
};

export async function authorizePriorYear(client: PrismaClient | Tx, actor: ConcessionActor, permission: string) {
  assertOperationalReleaseFeature(PRIOR_YEAR_CONCESSIONS_FEATURE);
  const decision = await evaluateEffectivePermission(client, { ...actor, permission });
  const user = await client.user.findUnique({ where: { id: actor.userId }, select: { designation: true } });
  const now = new Date();
  const reservedProfile = await client.userPermissionProfileAssignment.findFirst({ where: { userId: actor.userId, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }], profile: { status: "ACTIVE", normalizedName: "MARKS_ENTRY_OPERATOR" } }, select: { id: true } });
  if (reservedProfile) throw new Error("MARKS_ENTRY_CONTEXT_FORBIDDEN");
  if (/marks[\s_]*entry/i.test(user?.designation ?? "") || decision.profileNames.some((name) => /marks[\s_]*entry/i.test(name))) throw new Error("MARKS_ENTRY_CONTEXT_FORBIDDEN");
  if (!decision.allowed || !decision.role || deniedRoles.has(decision.role) || /marks\s*entry/i.test(decision.roleLabel ?? "")) throw new Error("PRIOR_YEAR_PERMISSION_DENIED");
  if (permission === "APPROVE_PRIOR_YEAR_CONCESSIONS" && !["SUPER_ADMIN", "DIRECTOR"].includes(decision.role) && !["USER_ALLOW", "PROFILE_ALLOW"].includes(decision.source)) throw new Error("EXPLICIT_MANAGEMENT_APPROVAL_GRANT_REQUIRED");
}

function inputRecord(raw: unknown): RecordInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("CONCESSION_INPUT_REQUIRED");
  return raw as RecordInput;
}

async function yearEligibility(tx: Tx, operatingYear: string, sourceYear: string, policy?: PriorYearPolicy) {
  const settings = await tx.schoolSettings.findUnique({ where: { id: "school" } });
  if (!settings || settings.academicYear !== operatingYear) throw new Error("OPERATING_YEAR_CHANGED");
  return eligiblePreviousYear(operatingYear, sourceYear, policy);
}

/** Read all relevant payment identities and versions. Unattributed active Old Due fails closed. */
export async function priorYearBalance(tx: Tx, liabilityId: string, policy?: PriorYearPolicy, allowPendingAttribution = false) {
  const liability = await tx.priorYearLiability.findUniqueOrThrow({ where: { id: liabilityId }, include: { student: { select: { id: true, deletedAt: true } }, paymentLinks: { include: { payment: true } }, events: { where: { eventType: { in: ["RELIEF_APPLIED", "RELIEF_REVERSED"] } }, orderBy: { id: "asc" } } } });
  if (liability.status !== "VERIFIED" || !liability.verifierId || !liability.verifiedAt || liability.verifierId === liability.preparerId) throw new Error("SOURCE_YEAR_UNVERIFIED");
  if (liability.student.deletedAt) throw new Error("STUDENT_UNAVAILABLE");
  await yearEligibility(tx, liability.operatingYear, liability.sourceYear, policy);
  const enrollment = await tx.academicYearEnrollment.findUnique({ where: { id: liability.sourceEnrollmentId } });
  if (!enrollment || enrollment.studentId !== liability.studentId || enrollment.academicYear !== liability.sourceYear) throw new Error("SOURCE_ENROLLMENT_CHANGED");
  const allOldPayments = await tx.payment.findMany({ where: { studentId: liability.studentId, feeType: "Old Due" }, include: { priorYearAttribution: true }, orderBy: { id: "asc" } });
  if (!allowPendingAttribution && allOldPayments.some((payment) => !payment.isCancelled && !payment.deletedAt && !payment.priorYearAttribution)) throw new Error("OLD_DUE_PAYMENT_ATTRIBUTION_REQUIRED");
  const receiptStates = await loadReceiptStateMap(tx, allOldPayments.map((payment) => payment.receiptNo));
  if ([...receiptStates.values()].some((state) => state.status !== "ACTIVE" && state.status !== "CANCELLED")) throw new Error("RECEIPT_INTEGRITY_REVIEW_REQUIRED");
  const applicable = liability.paymentLinks.map((link) => link.payment);
  if (applicable.some((payment) => payment.studentId !== liability.studentId || payment.feeType !== "Old Due")) throw new Error("PAYMENT_SOURCE_RECONCILIATION_REQUIRED");
  const validPayments = await effectiveActiveSelectedReceiptPayments(tx, applicable);
  const payments = sumPriorYearAmounts(validPayments.map((payment) => priorYearAmount(payment.amountPaid).toFixed(2)));
  const totals = reconcilePriorYear({ opening: liability.openingAmount.toString(), existingCredits: liability.existingCredits.toString(), payments: payments.toString(), appliedRelief: sumPriorYearAmounts(liability.events.filter((event) => event.eventType === "RELIEF_APPLIED").map((event) => event.amount)).toString(), reversals: sumPriorYearAmounts(liability.events.filter((event) => event.eventType === "RELIEF_REVERSED").map((event) => event.amount)).toString() });
  const receiptComponents = await tx.payment.findMany({ where: { receiptNo: { in: allOldPayments.map((payment) => payment.receiptNo) } }, select: { id: true, receiptNo: true, amountPaid: true, isCancelled: true, deletedAt: true, updatedAt: true }, orderBy: { id: "asc" } });
  const hash = concessionBalanceHash({ liability: { id: liability.id, version: liability.version, opening: liability.openingAmount.toString(), credits: liability.existingCredits.toString(), provenance: liability.provenance, source: liability.sourceReferencesJson, verifier: liability.verifierId }, policy: validatePriorYearPolicy(policy), receiptComponents, payments: allOldPayments.map((payment) => [payment.id, payment.amountPaid, payment.isCancelled, payment.deletedAt, payment.updatedAt, payment.priorYearAttribution?.liabilityId]), events: liability.events.map((event) => [event.id, event.eventType, event.amount.toString()]) });
  return { liability, totals, hash };
}

function eventResult(event: { id: string; caseId: string | null; liabilityId: string; newState: string | null; amount: Prisma.Decimal; eventType: string }) {
  return { eventId: event.id, caseId: event.caseId, liabilityId: event.liabilityId, status: event.newState, amount: event.amount.toFixed(2), eventType: event.eventType };
}

export async function mutatePriorYear(client: PrismaClient, actor: ConcessionActor, raw: unknown, context: Context = {}) {
  const input = inputRecord(raw), action = priorYearText(input.action, "Action", 32), permission = permissions[action];
  if (!permission) throw new Error("CONCESSION_ACTION_NOT_SUPPORTED");
  if (input.offline === true) throw new Error("OFFLINE_PRIOR_YEAR_POSTING_FORBIDDEN");
  await authorizePriorYear(client, actor, permission);
  const requestKey = priorYearText(input.requestKey, "Stable request key", 100);
  // Step-up tokens are credentials, never persisted in request fingerprints or audit bodies.
  const { stepUpToken: _token, ...safeInput } = input;
  const requestHash = authHashSecret(JSON.stringify({ actor: actor.userId, input: safeInput }), "prior-year-idempotency");
  const original = await client.priorYearConcessionEvent.findUnique({ where: { requestKey } });
  if (original) {
    if (original.requestHash !== requestHash || original.actorId !== actor.userId) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return eventResult(original);
  }
  const now = new Date();
  if (terminalPrivilege.has(action) && !await consumeStepUpGrant(client, { stepUpToken: String(input.stepUpToken ?? ""), userId: actor.userId, sessionId: actor.sessionId, action: `PRIOR_YEAR_${action}`, environment: process.env.NALANDA_ENVIRONMENT ?? "PRODUCTION", now })) throw new Error("PRIOR_YEAR_STEP_UP_REQUIRED");
  try {
    return await client.$transaction(async (tx) => {
      await authorizePriorYear(tx, actor, permission);
      const replay = await tx.priorYearConcessionEvent.findUnique({ where: { requestKey } });
      if (replay) {
        if (replay.requestHash !== requestHash || replay.actorId !== actor.userId) throw new Error("IDEMPOTENCY_KEY_REUSED");
        return eventResult(replay);
      }
      const eventBase = { actorId: actor.userId, requestKey, requestHash, reason: priorYearText(input.reason, "Audit reason", 1000) };
      if (action === "PREPARE_LIABILITY") {
        const studentId = priorYearText(input.studentId, "Exact Student ID", 80), operatingYear = priorYearText(input.operatingYear, "Operating academic year", 40), sourceYear = priorYearText(input.sourceYear, "Source academic year", 40);
        await yearEligibility(tx, operatingYear, sourceYear, context.policy);
        const student = await tx.student.findFirst({ where: { id: studentId, deletedAt: null } });
        const enrollment = await tx.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId, academicYear: sourceYear } } });
        if (!student || !enrollment || input.sourceEnrollmentId !== enrollment.id || input.identityVerified !== true) throw new Error("EXACT_REVIEWED_STUDENT_ENROLLMENT_REQUIRED");
        if (!Array.isArray(input.sourceReferences) || !input.sourceReferences.length || input.sourceReferences.length > 20) throw new Error("LIABILITY_SOURCE_REFERENCES_REQUIRED");
        const sourceReferences = input.sourceReferences.map((reference) => priorYearText(reference, "Fee-head/term evidence reference", 200));
        if (new Set(sourceReferences).size !== sourceReferences.length) throw new Error("DUPLICATE_SOURCE_REFERENCE");
        const openingAmount = priorYearAmount(input.openingAmount), existingCredits = priorYearAmount(input.existingCredits ?? "0", true);
        if (existingCredits.gt(openingAmount)) throw new Error("PREVIOUS_YEAR_RECONCILIATION_REQUIRED");
        const liability = await tx.priorYearLiability.create({ data: { studentId, operatingYear, sourceYear, sourceEnrollmentId: enrollment.id, openingAmount, existingCredits, sourceReferencesJson: JSON.stringify(sourceReferences), provenance: priorYearText(input.provenance, "Reviewed source and existing-credit provenance", 1000), preparerId: actor.userId } });
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId: liability.id, eventType: "ATTRIBUTION_PROPOSED", newState: "SOURCE_YEAR_UNVERIFIED" } }));
      }
      const caseId = typeof input.caseId === "string" ? input.caseId : null;
      const current = caseId ? await tx.priorYearConcessionCase.findUniqueOrThrow({ where: { id: caseId } }) : null;
      const liabilityId = current?.liabilityId ?? priorYearText(input.liabilityId, "Liability ID", 80);
      if (current && input.liabilityId != null && input.liabilityId !== current.liabilityId) throw new Error("CASE_LIABILITY_MISMATCH");
      if (["PREPARE", "VERIFY", "PREPARE_LIABILITY"].includes(action) && caseId) throw new Error("OFFICE_ACTION_MUST_BIND_LIABILITY_DIRECTLY");
      const liability = await tx.priorYearLiability.findUniqueOrThrow({ where: { id: liabilityId } });
      // Expiry cleanup is privacy maintenance, independent of academic rollover or financial reconciliation.
      if (action === "PURGE_INCOME") {
        if (!current) throw new Error("CASE_REFERENCE_REQUIRED");
        const income = await tx.priorYearIncomeSupport.findUnique({ where: { caseId: current.id } });
        if (!income?.expiresAt || income.expiresAt > now || !validatePriorYearPolicy(context.policy).incomeRetentionDays) throw new Error("INCOME_RETENTION_NOT_DUE");
        await tx.priorYearIncomeSupport.update({ where: { id: income.id }, data: { status: "NOT_PROVIDED", bandId: null, exactAmountEnvelope: null } });
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, reason: "Expired optional income values purged under retention policy", liabilityId, caseId: current.id, eventType: "INCOME_SUPPORT_PURGED", newState: current.status } }));
      }
      await yearEligibility(tx, liability.operatingYear, liability.sourceYear, context.policy);
      if (action === "PROPOSE_PAYMENT" || action === "VERIFY_PAYMENT") {
        if (!["VERIFIED", "SOURCE_YEAR_UNVERIFIED"].includes(liability.status)) throw new Error("SOURCE_YEAR_UNVERIFIED");
        const proposal = action === "VERIFY_PAYMENT" ? await tx.priorYearConcessionEvent.findUniqueOrThrow({ where: { id: priorYearText(input.proposalEventId, "Payment attribution proposal", 80) } }) : null;
        if (proposal && (proposal.liabilityId !== liabilityId || proposal.eventType !== "PAYMENT_ATTRIBUTION_PROPOSED" || proposal.actorId === actor.userId)) throw new Error("INDEPENDENT_PAYMENT_ATTRIBUTION_REQUIRED");
        const paymentId = proposal?.referenceId ?? priorYearText(input.paymentId, "Existing received Payment ID", 80);
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
        const sourceYear = priorYearText(input.sourceYear, "Verified payment source academic year", 40);
        const policy = validatePriorYearPolicy(context.policy), operating = policy.academicYears.find((year) => year.id === liability.operatingYear), source = policy.academicYears.find((year) => year.id === sourceYear);
        if (!source || !operating || source.sequence >= operating.sequence) throw new Error("PRIOR_PAYMENT_SOURCE_YEAR_REQUIRED");
        if (payment.studentId !== liability.studentId || payment.feeType !== "Old Due" || payment.isCancelled || payment.deletedAt) throw new Error("ACTUAL_ACTIVE_OLD_DUE_PAYMENT_REQUIRED");
        const sourceEnrollment = await tx.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId: liability.studentId, academicYear: sourceYear } } });
        if (!sourceEnrollment || input.sourceEnrollmentId !== sourceEnrollment.id || input.identityVerified !== true) throw new Error("EXACT_REVIEWED_STUDENT_ENROLLMENT_REQUIRED");
        const siblings = await tx.payment.findMany({ where: { receiptNo: payment.receiptNo }, orderBy: { id: "asc" } });
        if (!(await effectiveActiveSelectedReceiptPayments(tx, [payment])).length) throw new Error("RECEIPT_INTEGRITY_REVIEW_REQUIRED");
        const paymentHash = concessionBalanceHash({ paymentId, sourceYear, enrollment: sourceEnrollment.id, amount: payment.amountPaid, version: liability.version, siblings: siblings.map((row) => [row.id, row.amountPaid, row.isCancelled, row.deletedAt, row.updatedAt]) });
        if (!proposal) return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: current?.id, eventType: "PAYMENT_ATTRIBUTION_PROPOSED", referenceId: payment.id, balanceHash: paymentHash, balanceVersion: liability.version, amount: priorYearAmount(payment.amountPaid) } }));
        if (input.expectedLiabilityVersion !== liability.version || proposal.balanceHash !== paymentHash) throw new Error("PAYMENT_ATTRIBUTION_CHANGED_REVIEW_AGAIN");
        await tx.priorYearPaymentAttribution.create({ data: { liabilityId: sourceYear === liability.sourceYear ? liabilityId : null, sourceYear, paymentId, recordedById: proposal.actorId, reviewedById: actor.userId, provenance: eventBase.reason } });
        const changed = await tx.priorYearLiability.updateMany({ where: { id: liabilityId, version: liability.version }, data: { version: { increment: 1 } } });
        if (changed.count !== 1) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
        // All received payments must now be reviewed. A negative balance requires a governed refund/reconciliation, not an extra credit.
        if (liability.status === "VERIFIED") await priorYearBalance(tx, liabilityId, context.policy, true);
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: current?.id, eventType: sourceYear === liability.sourceYear ? "ACTUAL_PAYMENT_ATTRIBUTED" : "OLDER_PAYMENT_CLASSIFIED_NO_RELIEF", referenceId: payment.id, balanceHash: paymentHash, amount: priorYearAmount(payment.amountPaid) } }));
      }
      if (action === "VERIFY") {
        if (liability.status !== "SOURCE_YEAR_UNVERIFIED" || liability.preparerId === actor.userId) throw new Error("INDEPENDENT_LIABILITY_VERIFICATION_REQUIRED");
        if (input.expectedVersion !== liability.version || input.identityVerified !== true || input.balanceVerified !== true) throw new Error("REVIEWED_BALANCE_VERSION_REQUIRED");
        if (!Array.isArray(input.paymentIds) || input.paymentIds.length > 1000 || new Set(input.paymentIds).size !== input.paymentIds.length) throw new Error("REVIEWED_PAYMENT_REFERENCES_REQUIRED");
        const paymentIds = input.paymentIds.map((id) => priorYearText(id, "Payment ID", 80));
        for (const paymentId of paymentIds) {
          const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
          if (payment.studentId !== liability.studentId || payment.feeType !== "Old Due") throw new Error("PAYMENT_SOURCE_RECONCILIATION_REQUIRED");
          await tx.priorYearPaymentAttribution.create({ data: { liabilityId, sourceYear: liability.sourceYear, paymentId, recordedById: liability.preparerId, reviewedById: actor.userId, provenance: eventBase.reason } });
        }
        const changed = await tx.priorYearLiability.updateMany({ where: { id: liabilityId, version: liability.version, status: "SOURCE_YEAR_UNVERIFIED" }, data: { status: "VERIFIED", verifierId: actor.userId, verifiedAt: now, version: { increment: 1 } } });
        if (changed.count !== 1) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
        const verified = await priorYearBalance(tx, liabilityId, context.policy);
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, eventType: "ATTRIBUTION_VERIFIED", newState: "VERIFIED", balanceHash: verified.hash, balanceVersion: verified.liability.version } }));
      }
      const balance = await priorYearBalance(tx, liabilityId, context.policy);
      if (action === "PREPARE") {
        if (balance.totals.remaining.lte(0)) throw new Error("NO_PREVIOUS_YEAR_OUTSTANDING");
        const requestedAmount = priorYearAmount(input.requestedAmount);
        if (requestedAmount.gt(balance.totals.remaining)) throw new Error("RELIEF_EXCEEDS_REMAINING_LIABILITY");
        const kind = priorYearText(input.kind, "Relief meaning", 40);
        if (!["SCHOOL_WAIVER", "SPONSORSHIP_PROMISE", ...(validatePriorYearPolicy(context.policy).scholarshipsEnabled ? ["SCHOLARSHIP"] : [])].includes(kind)) throw new Error("RELIEF_POLICY_NOT_ENABLED");
        const validFrom = localDate(input.validFrom), validTo = localDate(input.validTo);
        if (validFrom > validTo) throw new Error("CONCESSION_EFFECTIVE_DATES_INVALID");
        const created = await tx.priorYearConcessionCase.create({ data: { liabilityId, kind, requestedAmount, reason: eventBase.reason, scopeJson: liability.sourceReferencesJson, preparerId: actor.userId, applicantReference: priorYearText(input.applicantReference, "Applicant reference", 120), validFrom, validTo } });
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: created.id, eventType: "CASE_PREPARED", newState: "DRAFT", amount: requestedAmount } }));
      }
      if (!current || input.expectedVersion !== current.version) throw new Error("CASE_VERSION_CHANGED");
      if (["APPROVE", "APPLY"].includes(action) && !["SCHOOL_WAIVER", "SPONSORSHIP_PROMISE", ...(validatePriorYearPolicy(context.policy).scholarshipsEnabled ? ["SCHOLARSHIP"] : [])].includes(current.kind)) throw new Error("RELIEF_POLICY_NOT_ENABLED");
      if (action === "REVIEW_REVERSAL") {
        if (current.status !== "APPLIED" || current.preparerId === actor.userId) throw new Error("INDEPENDENT_REVERSAL_REVIEW_REQUIRED");
        if (input.balanceHash !== balance.hash || input.balanceVersion !== balance.liability.version) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: current.id, eventType: "REVERSAL_REVIEWED", balanceHash: balance.hash, balanceVersion: balance.liability.version, amount: current.approvedAmount ?? "0" } }));
      }
      if (action === "AMEND") {
        if (!["DRAFT", "RETURNED"].includes(current.status) || current.preparerId !== actor.userId) throw new Error("CASE_NOT_EDITABLE");
        const requestedAmount = priorYearAmount(input.requestedAmount), validFrom = localDate(input.validFrom), validTo = localDate(input.validTo);
        if (requestedAmount.gt(balance.totals.remaining) || validFrom > validTo) throw new Error("AMENDMENT_REQUIRES_REVIEW");
        const changed = await tx.priorYearConcessionCase.updateMany({ where: { id: current.id, version: current.version }, data: { requestedAmount, validFrom, validTo, reason: eventBase.reason, reviewerId: null, approverId: null, approvedAmount: null, balanceHash: null, balanceVersion: null, version: { increment: 1 } } });
        if (changed.count !== 1) throw new Error("CASE_VERSION_CHANGED");
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: current.id, eventType: "CASE_AMENDED", previousState: current.status, newState: current.status, amount: requestedAmount } }));
      }
      if (action === "INCOME") {
        if (!["DRAFT", "RETURNED"].includes(current.status) || current.preparerId !== actor.userId) throw new Error("CASE_NOT_EDITABLE");
        const income = normalizeIncomeSupport(input.income, context.policy);
        if (income.exactAnnualAmount !== null) await authorizePriorYear(tx, actor, "VIEW_EXACT_PRIOR_YEAR_INCOME");
        const exactAmountEnvelope = income.exactAnnualAmount === null ? null : JSON.stringify(encryptMfaSecret(income.exactAnnualAmount, `prior-year-income:${current.id}`));
        const days = validatePriorYearPolicy(context.policy).incomeRetentionDays;
        const data = { status: income.status, bandId: income.bandId, exactAmountEnvelope, expiresAt: days ? new Date(now.getTime() + days * 86400000) : null, recordedById: actor.userId };
        await tx.priorYearIncomeSupport.upsert({ where: { caseId: current.id }, create: { caseId: current.id, ...data }, update: data });
        await tx.priorYearConcessionCase.update({ where: { id: current.id }, data: { version: { increment: 1 } } });
        return eventResult(await tx.priorYearConcessionEvent.create({ data: { ...eventBase, reason: "Optional income support updated; values restricted", liabilityId, caseId: current.id, eventType: "INCOME_SUPPORT_UPDATED", newState: current.status } }));
      }
      const target: Record<string, PriorYearState> = { SUBMIT: "SUBMITTED", REVIEW: "UNDER_REVIEW", RETURN: "RETURNED", REJECT: "REJECTED", APPROVE: "APPROVED", APPLY: "APPLIED", EXPIRE: "EXPIRED", REVERSE: "REVERSED" };
      const next = target[action];
      if (!next) throw new Error("CONCESSION_ACTION_NOT_SUPPORTED");
      assertPriorYearTransition(current.status, next);
      const change: Prisma.PriorYearConcessionCaseUpdateManyMutationInput = { status: next, version: { increment: 1 } };
      let eventType = `CASE_${next}`, amount = new Prisma.Decimal(0), reversesEventId: string | null = null;
      if (action === "SUBMIT" && current.preparerId !== actor.userId) throw new Error("ONLY_CASE_PREPARER_CAN_SUBMIT");
      if (action === "REVIEW") {
        if (current.preparerId === actor.userId) throw new Error("INDEPENDENT_REVIEW_REQUIRED");
        change.reviewerId = actor.userId;
      }
      if (["RETURN", "REJECT"].includes(action) && current.reviewerId !== actor.userId) throw new Error("ASSIGNED_REVIEWER_REQUIRED");
      if (action === "RETURN") { change.balanceHash = null; change.balanceVersion = null; change.approverId = null; change.approvedAmount = null; }
      if (action === "APPROVE") {
        approvalSeparation(current.preparerId, current.reviewerId, actor.userId);
        if (input.balanceHash !== balance.hash || input.balanceVersion !== balance.liability.version) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
        amount = priorYearAmount(input.approvedAmount);
        if (amount.gt(current.requestedAmount) || amount.gt(balance.totals.remaining)) throw new Error("RELIEF_EXCEEDS_REMAINING_LIABILITY");
        if (now > new Date(current.validTo.getTime() + 86400000 - 1)) throw new Error("CONCESSION_EXPIRED");
        Object.assign(change, { approvedAmount: amount, approverId: actor.userId, balanceHash: balance.hash, balanceVersion: balance.liability.version });
      }
      if (action === "EXPIRE" && now <= new Date(current.validTo.getTime() + 86400000 - 1)) throw new Error("CONCESSION_NOT_EXPIRED");
      if (action === "APPLY") {
        if (actor.userId === current.approverId) throw new Error("SEPARATE_APPLICATION_ACTOR_REQUIRED");
        if (current.kind === "SPONSORSHIP_PROMISE") throw new Error("SPONSORSHIP_PROMISE_IS_NOT_MONEY_OR_WAIVER");
        if (now < current.validFrom || now > new Date(current.validTo.getTime() + 86400000 - 1)) throw new Error("CONCESSION_OUTSIDE_EFFECTIVE_DATES");
        if (current.balanceHash !== balance.hash || current.balanceVersion !== balance.liability.version) throw new Error("STALE_APPROVAL_REVALIDATION_AND_REAPPROVAL_REQUIRED");
        if (!current.approvedAmount || current.approvedAmount.lte(0) || current.approvedAmount.gt(balance.totals.remaining)) throw new Error("RELIEF_EXCEEDS_REMAINING_LIABILITY");
        amount = current.approvedAmount; eventType = "RELIEF_APPLIED";
        const locked = await tx.priorYearLiability.updateMany({ where: { id: liabilityId, version: balance.liability.version }, data: { version: { increment: 1 } } });
        if (locked.count !== 1) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
        change.appliedVersion = balance.liability.version + 1;
      }
      if (action === "REVERSE") {
        if (current.appliedVersion !== balance.liability.version || current.appliedBalanceHash !== balance.hash) {
          const review = await tx.priorYearConcessionEvent.findFirst({ where: { caseId: current.id, eventType: "REVERSAL_REVIEWED", balanceHash: balance.hash, balanceVersion: balance.liability.version, actorId: { not: actor.userId } }, orderBy: { createdAt: "desc" } });
          if (!review) throw new Error("DEPENDENT_TRANSACTIONS_REQUIRE_GOVERNED_REVIEW");
        }
        const applied = await tx.priorYearConcessionEvent.findFirstOrThrow({ where: { caseId: current.id, eventType: "RELIEF_APPLIED" } });
        reversesEventId = applied.id; amount = applied.amount; eventType = "RELIEF_REVERSED";
        const locked = await tx.priorYearLiability.updateMany({ where: { id: liabilityId, version: balance.liability.version }, data: { version: { increment: 1 } } });
        if (locked.count !== 1) throw new Error("BALANCE_CHANGED_REVIEW_AGAIN");
      }
      const changed = await tx.priorYearConcessionCase.updateMany({ where: { id: current.id, version: current.version, status: current.status }, data: change });
      if (changed.count !== 1) throw new Error("CASE_VERSION_CHANGED");
      const event = await tx.priorYearConcessionEvent.create({ data: { ...eventBase, liabilityId, caseId: current.id, previousState: current.status, newState: next, eventType, amount, reversesEventId, balanceHash: balance.hash, balanceVersion: balance.liability.version } });
      if (action === "APPLY") {
        const after = await priorYearBalance(tx, liabilityId, context.policy);
        await tx.priorYearConcessionCase.update({ where: { id: current.id }, data: { appliedBalanceHash: after.hash } });
      }
      return eventResult(event);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  } catch (error) {
    // A commit followed by a lost response must return its immutable original result.
    const committed = await client.priorYearConcessionEvent.findUnique({ where: { requestKey } });
    if (committed && committed.actorId === actor.userId && committed.requestHash === requestHash) return eventResult(committed);
    throw error;
  }
}

export async function readPriorYearIncome(client: PrismaClient, actor: ConcessionActor, caseId: string, exact = false, context: Context = {}) {
  await authorizePriorYear(client, actor, "VIEW_PRIOR_YEAR_INCOME");
  if (exact) await authorizePriorYear(client, actor, "VIEW_EXACT_PRIOR_YEAR_INCOME");
  const current = await client.priorYearConcessionCase.findUniqueOrThrow({ where: { id: caseId } });
  await priorYearBalance(client, current.liabilityId, context.policy);
  const income = await client.priorYearIncomeSupport.findUnique({ where: { caseId } });
  if (!income || (income.expiresAt && income.expiresAt <= new Date())) return { status: "NOT_PROVIDED", bandId: null, exactAnnualAmount: null };
  const result = { status: income.status, bandId: income.bandId, exactAnnualAmount: exact && income.exactAmountEnvelope ? decryptMfaSecret(income.exactAmountEnvelope, `prior-year-income:${caseId}`) : null };
  await client.priorYearConcessionEvent.create({ data: { liabilityId: current.liabilityId, caseId, actorId: actor.userId, eventType: exact ? "EXACT_INCOME_VIEWED" : "INCOME_VIEWED", reason: "Restricted support viewed", requestKey: randomUUID(), requestHash: concessionBalanceHash({ caseId, exact }) } });
  return result;
}
