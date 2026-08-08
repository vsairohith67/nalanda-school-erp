import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { authHashSecret } from "@/lib/auth-security";
import { effectiveDiscountPercent } from "@/lib/fee-allocation";
import {
  automaticFamilyAllocation,
  canonicalFamilyHash,
  compareDuePositions,
  duePositionKey,
  FAMILY_COLLECTION_LIMITS,
  maskedExternalPaymentReference,
  normalizeFamilyInstruments,
  normalizeFamilyShares,
  normalizeManualFamilyAllocation,
  requiresFamilyInstrumentReference,
  rupeesFromPaise,
  type FamilyAllocationInput,
  type FamilyDuePosition,
  type FamilyInstrumentInput,
  type FamilyShareInput
} from "@/lib/family-collection-allocation";
import { effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";
import { receiptAuditSnapshot } from "@/lib/receipt";
import {
  publishReceiptLeadershipNotification,
  receiptLeadershipEventKey,
  type ReceiptLeadershipActor
} from "@/lib/receipt-leadership-notifications";
import { schoolDateKey } from "@/lib/format";

export const FAMILY_COLLECTION_POLICY_VERSION = "FAMILY_AUTO_V1";
export const FAMILY_COLLECTION_PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  pragma: "no-cache",
  "x-content-type-options": "nosniff"
} as const;

type FamilyActor = ReceiptLeadershipActor & { role: string };
type FamilyClient = PrismaClient | any;

type Selection = { admissionNo: string; academicYear: string };

export class FamilyCollectionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "FamilyCollectionError";
  }
}

class FamilyLockedDayError extends FamilyCollectionError {
  constructor(public readonly review: {
    actor: FamilyActor;
    reference: string;
    totalPaise: number;
    date: Date;
    reason: string;
    dayStatus: string;
  }) {
    super("This collection belongs to a protected Cash Book day and requires leadership review", 409);
    this.name = "FamilyLockedDayError";
  }
}

export async function previewFamilyCollection(client: FamilyClient, raw: unknown, options: { ignoreCollectionId?: string } = {}) {
  const request = normalizePreviewEnvelope(raw);
  const payer = await resolvePayerAndEligibility(client, request);
  const correctionCollection = request.correctionOfReference
    ? await client.familyCollection.findUnique({ where: { publicReference: request.correctionOfReference }, select: { id: true, status: true } })
    : null;
  const correctionStatusAllowed = options.ignoreCollectionId
    ? correctionCollection?.id === options.ignoreCollectionId && ["ISSUED", "SUPERSEDED"].includes(correctionCollection.status)
    : correctionCollection?.status === "ISSUED";
  if (request.correctionOfReference && !correctionStatusAllowed) {
    throw new FamilyCollectionError("Correction source collection is not currently issued", 409);
  }
  if (options.ignoreCollectionId && correctionCollection?.id !== options.ignoreCollectionId) {
    throw new FamilyCollectionError("Correction source collection does not match the governed workflow", 409);
  }
  const ignoredCollectionId = options.ignoreCollectionId ?? correctionCollection?.id ?? null;
  const duePositions = await resolveFamilyDuePositions(client, request.selections, payer.guardianId, ignoredCollectionId);
  const instruments = normalizeFamilyInstruments(request.instruments);
  const references = instrumentReferenceMaterial(instruments);
  await assertInstrumentReferencesAvailable(client, references);
  const allocationResult = request.allocationMode === "AUTO"
    ? automaticFamilyAllocation(duePositions, instruments)
    : {
        allocations: normalizeManualFamilyAllocation(request.allocations, duePositions, instruments),
        shares: [] as FamilyShareInput[]
      };
  const shares = request.allocationMode === "AUTO"
    ? allocationResult.shares
    : normalizeFamilyShares(request.shares, allocationResult.allocations, instruments);
  const allocations = allocationResult.allocations;
  const dueByKey = new Map(duePositions.map((row) => [duePositionKey(row), row]));
  const planMaterial = {
    payer: {
      type: payer.payerType,
      guardianKey: payer.guardianKey,
      counterpartyReferenceHash: payer.counterpartyReferenceHash,
      counterpartyDisplay: payer.counterpartyDisplay
    },
    collectionDate: request.collectionDate.toISOString(),
    correctionOfReference: request.correctionOfReference,
    allocationMode: request.allocationMode,
    policyVersion: FAMILY_COLLECTION_POLICY_VERSION,
    instruments: instruments.map((row, index) => ({
      clientKey: row.clientKey,
      ordinal: index + 1,
      mode: normalizedMode(row.mode),
      amountPaise: row.amountPaise,
      receivedAccount: row.receivedAccount,
      referenceKey: references[index].referenceKey
    })),
    allocations: allocations.map((row, index) => {
      const due = dueByKey.get(duePositionKey(row));
      if (!due) throw new FamilyCollectionError("Allocation no longer matches an eligible due", 409);
      return {
        ...row,
        orderIndex: index + 1,
        dueBeforePaise: due.duePaise,
        dueAfterPaise: due.duePaise - row.amountPaise,
        dueSnapshotHash: due.dueSnapshotHash
      };
    }),
    shares,
    auditReason: request.auditReason
  };
  const totalPaise = instruments.reduce((sum, row) => sum + row.amountPaise, 0);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) throw new FamilyCollectionError("Collection total is invalid");
  const planHash = canonicalFamilyHash(planMaterial);
  return {
    planHash,
    requestFingerprint: canonicalFamilyHash({ planHash, payerType: payer.payerType }),
    policyVersion: FAMILY_COLLECTION_POLICY_VERSION,
    familyCreditPaise: 0,
    totalPaise,
    payer: {
      type: payer.payerType,
      displayName: payer.displayName,
      guardianKey: payer.guardianKey
    },
    collectionDate: request.collectionDate,
    instruments: planMaterial.instruments.map((row, index) => ({
      ...row,
      referenceMasked: references[index].referenceMasked
    })),
    allocations: planMaterial.allocations.map((row) => {
      const due = dueByKey.get(duePositionKey(row))!;
      return {
        ...row,
        studentName: due.studentName,
        className: due.className,
        section: due.section
      };
    }),
    shares,
    remainingByStudent: remainingByStudent(duePositions, allocations),
    eligibleDues: duePositions,
    normalizedRequest: request,
    privatePlanMaterial: planMaterial,
    privatePayer: payer,
    privateReferences: references
  };
}

export async function confirmFamilyCollection(
  client: PrismaClient,
  raw: unknown,
  actor: FamilyActor,
  options: { replacesCollectionId?: string } = {}
) {
  const body = object(raw, "Collection confirmation");
  if (body.correctionOfReference) throw new FamilyCollectionError("Correction previews must be confirmed through the governed correction workflow", 409);
  const requestKey = boundedKey(body.requestKey, "Request key", 120);
  const suppliedPlanHash = boundedHash(body.planHash, "Allocation plan hash");
  const requestFingerprint = canonicalFamilyHash({ requestKey, request: body });
  const existing = await client.familyCollection.findUnique({ where: { requestKey }, select: { id: true, requestFingerprint: true } });
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) throw new FamilyCollectionError("Request key was already used for different collection content", 409);
    return loadFamilyCollection(client, existing.id);
  }
  const preview = await previewFamilyCollection(client, body);
  if (preview.planHash !== suppliedPlanHash) throw new FamilyCollectionError("Allocation plan is stale or changed; preview again", 409);
  try {
    return await client.$transaction(async (tx: any) => {
      const raced = await tx.familyCollection.findUnique({ where: { requestKey }, select: { id: true, requestFingerprint: true } });
      if (raced) {
        if (raced.requestFingerprint !== requestFingerprint) throw new FamilyCollectionError("Request key was already used for different collection content", 409);
        return loadFamilyCollection(tx, raced.id);
      }
      const transactionPreview = await previewFamilyCollection(tx, body);
      if (transactionPreview.planHash !== suppliedPlanHash) throw new FamilyCollectionError("Student dues changed after preview; review the allocation again", 409);
      return postFamilyCollectionInTransaction(tx, transactionPreview, requestKey, requestFingerprint, actor, options);
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      const raced = await client.familyCollection.findUnique({ where: { requestKey }, select: { id: true, requestFingerprint: true } });
      if (raced?.requestFingerprint === requestFingerprint) return loadFamilyCollection(client, raced.id);
      throw new FamilyCollectionError("Collection reference or payment instrument was already posted", 409);
    }
    throw error;
  }
}

export async function reverseFamilyCollection(
  client: PrismaClient,
  reference: string,
  input: unknown,
  actor: FamilyActor
) {
  const body = object(input, "Reversal request");
  const expectedVersion = positiveInteger(body.expectedVersion, "Expected collection version");
  const reason = safeReason(body.reason, "Reversal reason");
  return withLockedDayReview(client, () => client.$transaction(async (tx: any) => {
    const collection = await tx.familyCollection.findUnique({
      where: { publicReference: boundedReference(reference) },
      include: {
        instruments: true,
        allocations: { include: { shares: true } },
        receiptVersions: { orderBy: { versionNumber: "desc" } },
        compatibilityPayments: true,
        replacedByCollection: { select: { id: true } }
      }
    });
    if (!collection) throw new FamilyCollectionError("Family collection was not found", 404);
    if (collection.status === "REVERSED") return loadFamilyCollection(tx, collection.id);
    if (collection.status !== "ISSUED") throw new FamilyCollectionError("Only an issued family collection can be reversed", 409);
    if (collection.version !== expectedVersion) throw new FamilyCollectionError("Family collection changed; refresh and review it", 409);
    await assertMutableAccountingDay(tx, collection.collectionDate, actor, collection.publicReference, collection.totalPaise, reason);
    await reverseInTransaction(tx, collection, reason, actor, "REVERSED");
    return loadFamilyCollection(tx, collection.id);
  }));
}

export async function correctFamilyCollection(
  client: PrismaClient,
  reference: string,
  input: unknown,
  actor: FamilyActor
) {
  const body = object(input, "Correction request");
  const expectedVersion = positiveInteger(body.expectedVersion, "Expected collection version");
  const reason = safeReason(body.reason, "Correction reason");
  const replacement = object(body.replacement, "Replacement collection");
  if (boundedReference(replacement.correctionOfReference) !== boundedReference(reference)) {
    throw new FamilyCollectionError("Replacement must identify the governed source collection", 409);
  }
  const replacementRequestKey = boundedKey(replacement.requestKey, "Replacement request key", 120);
  const replacementPlanHash = boundedHash(replacement.planHash, "Replacement allocation plan hash");
  return withLockedDayReview(client, () => client.$transaction(async (tx: any) => {
    const collection = await tx.familyCollection.findUnique({
      where: { publicReference: boundedReference(reference) },
      include: {
        instruments: true,
        allocations: { include: { shares: true } },
        receiptVersions: { orderBy: { versionNumber: "desc" } },
        compatibilityPayments: true,
        replacedByCollection: { select: { id: true } }
      }
    });
    if (!collection) throw new FamilyCollectionError("Family collection was not found", 404);
    if (collection.replacedByCollection) return loadFamilyCollection(tx, collection.replacedByCollection.id);
    if (collection.status !== "ISSUED" || collection.version !== expectedVersion) {
      throw new FamilyCollectionError("Family collection changed; refresh and review it", 409);
    }
    await assertMutableAccountingDay(tx, collection.collectionDate, actor, collection.publicReference, collection.totalPaise, reason);
    await reverseInTransaction(tx, collection, reason, actor, "SUPERSEDED");
    const preview = await previewFamilyCollection(tx, replacement, { ignoreCollectionId: collection.id });
    if (preview.planHash !== replacementPlanHash) throw new FamilyCollectionError("Replacement allocation plan is stale; preview again", 409);
    const fingerprint = canonicalFamilyHash({ requestKey: replacementRequestKey, request: replacement });
    const posted = await postFamilyCollectionInTransaction(tx, preview, replacementRequestKey, fingerprint, actor, { replacesCollectionId: collection.id });
    await tx.familyCollectionEvent.create({
      data: {
        collectionId: collection.id,
        eventType: "CORRECTED",
        previousStatus: "ISSUED",
        newStatus: "SUPERSEDED",
        collectionVersion: expectedVersion + 1,
        actorUserId: actor.id,
        actorName: actor.name,
        reason,
        detailsJson: JSON.stringify({ replacementReference: posted.publicReference })
      }
    });
    if (actor.role === "ACCOUNTANT") {
      await publishReceiptLeadershipNotification(tx, {
        eventKey: receiptLeadershipEventKey([collection.publicReference, "FAMILY_CORRECTED", expectedVersion + 1]),
        action: "CORRECTED",
        receiptNo: collection.publicReference,
        amount: rupeesFromPaise(collection.totalPaise),
        receiptDate: collection.collectionDate,
        actor,
        reason,
        versionReference: `${collection.publicReference} → ${posted.publicReference}`
      });
    }
    return posted;
  }));
}

export async function prepareFamilyProviderPlan(client: PrismaClient, reference: string, actor: FamilyActor) {
  return client.$transaction(async (tx: any) => {
    const row = await tx.familyCollection.findUnique({
      where: { publicReference: boundedReference(reference) },
      include: { allocations: { orderBy: { orderIndex: "asc" } }, providerPlans: { orderBy: { planVersion: "desc" }, take: 1 } }
    });
    if (!row || row.status !== "ISSUED") throw new FamilyCollectionError("Only an issued collection can produce a future provider allocation plan", 409);
    if (row.providerPlans[0]) return row.providerPlans[0];
    const snapshot = providerPlanSnapshot(row);
    return tx.familyProviderAllocationPlan.create({
      data: {
        publicKey: `FPAP-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`,
        collectionId: row.id,
        planVersion: 1,
        status: "PREPARED",
        amountPaise: row.totalPaise,
        planHash: canonicalFamilyHash(snapshot),
        snapshotJson: JSON.stringify(snapshot),
        createdByUserId: actor.id
      }
    });
  });
}

export async function findFamilyEligibility(client: PrismaClient, input: { guardianQuery?: string; admissionNo?: string }) {
  if (input.guardianQuery) {
    const query = boundedSearch(input.guardianQuery);
    const rows = await client.guardian.findMany({
      where: { status: "Active", iamPublicKey: { not: null }, OR: [{ displayName: { contains: query } }, { primaryMobile: query }] },
      select: {
        iamPublicKey: true,
        displayName: true,
        students: {
          where: { canViewFees: true, student: { deletedAt: null } },
          select: { student: { select: { admissionNo: true, studentName: true, className: true, section: true, academicYear: true } } }
        }
      },
      take: 20,
      orderBy: { displayName: "asc" }
    });
    return rows.map((row) => ({
      guardianKey: row.iamPublicKey,
      displayName: row.displayName,
      children: row.students.map((link) => link.student)
    }));
  }
  if (input.admissionNo) {
    const student = await client.student.findUnique({
      where: { admissionNo: boundedText(input.admissionNo, "Admission number", 80) },
      select: { admissionNo: true, studentName: true, className: true, section: true, academicYear: true, deletedAt: true }
    });
    return student && !student.deletedAt ? [{ student }] : [];
  }
  throw new FamilyCollectionError("Guardian query or admission number is required");
}

export async function familyReceiptForUser(client: PrismaClient, reference: string, user: { id: string; role: string; guardianId?: string | null }, childOnlyAdmissionNo?: string) {
  const collection = await client.familyCollection.findUnique({
    where: { publicReference: boundedReference(reference) },
    include: familyCollectionInclude
  });
  if (!collection || !["ISSUED", "REVERSED", "SUPERSEDED"].includes(collection.status)) throw new FamilyCollectionError("Family receipt was not found", 404);
  if (user.role !== "PARENT") return serializeFamilyCollection(collection);
  if (!user.guardianId) throw new FamilyCollectionError("Family receipt was not found", 404);
  const linked = await client.studentGuardian.findMany({
    where: { guardianId: user.guardianId, canViewFees: true, guardian: { status: "Active" }, studentId: { in: collection.allocations.map((row: any) => row.studentId) } },
    select: { studentId: true }
  });
  const authorized = new Set(linked.map((row) => row.studentId));
  if (!authorized.size) throw new FamilyCollectionError("Family receipt was not found", 404);
  const allAuthorized = collection.allocations.every((row: any) => authorized.has(row.studentId));
  const serialized = serializeFamilyCollection(collection);
  if (allAuthorized && !childOnlyAdmissionNo) return serialized;
  const allowedAdmission = childOnlyAdmissionNo
    ? collection.allocations.find((row: any) => row.admissionNoSnapshot === childOnlyAdmissionNo && authorized.has(row.studentId))?.admissionNoSnapshot
    : collection.allocations.find((row: any) => authorized.has(row.studentId))?.admissionNoSnapshot;
  if (!allowedAdmission) throw new FamilyCollectionError("Family receipt was not found", 404);
  return childExtract(serialized, allowedAdmission);
}

export async function loadFamilyCollection(client: FamilyClient, idOrReference: string) {
  const collection = await client.familyCollection.findFirst({
    where: { OR: [{ id: idOrReference }, { publicReference: idOrReference }] },
    include: familyCollectionInclude
  });
  if (!collection) throw new FamilyCollectionError("Family collection was not found", 404);
  return serializeFamilyCollection(collection);
}

const familyCollectionInclude = {
  instruments: { orderBy: { ordinal: "asc" as const } },
  allocations: { include: { shares: true }, orderBy: { orderIndex: "asc" as const } },
  receiptVersions: { orderBy: { versionNumber: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
  providerPlans: { orderBy: { planVersion: "asc" as const } },
  replacesCollection: { select: { publicReference: true } },
  replacedByCollection: { select: { publicReference: true } }
};

async function postFamilyCollectionInTransaction(
  tx: any,
  preview: Awaited<ReturnType<typeof previewFamilyCollection>>,
  requestKey: string,
  requestFingerprint: string,
  actor: FamilyActor,
  options: { replacesCollectionId?: string }
) {
  const publicReference = newFamilyReference(preview.collectionDate);
  const collection = await tx.familyCollection.create({
    data: {
      publicReference,
      receiptReference: publicReference,
      payerType: preview.privatePayer.payerType,
      payerGuardianId: preview.privatePayer.guardianId,
      payerDisplayName: preview.privatePayer.displayName,
      counterpartyReferenceHash: preview.privatePayer.counterpartyReferenceHash,
      counterpartyDisplay: preview.privatePayer.counterpartyDisplay,
      collectionDate: preview.collectionDate,
      status: "ISSUED",
      requestKey,
      requestFingerprint,
      allocationPlanHash: preview.planHash,
      allocationPolicyVersion: FAMILY_COLLECTION_POLICY_VERSION,
      totalPaise: preview.totalPaise,
      creditPaise: 0,
      version: 1,
      currentReceiptVersion: 1,
      auditReason: preview.normalizedRequest.auditReason,
      createdByUserId: actor.id,
      replacesCollectionId: options.replacesCollectionId
    }
  });
  const instrumentByClientKey = new Map<string, any>();
  for (let index = 0; index < preview.instruments.length; index += 1) {
    const instrument = preview.instruments[index];
    const created = await tx.familyCollectionInstrument.create({
      data: {
        collectionId: collection.id,
        ordinal: index + 1,
        mode: instrument.mode,
        amountPaise: instrument.amountPaise,
        receivedAccount: instrument.receivedAccount,
        referenceMasked: instrument.referenceMasked,
        referenceKey: instrument.referenceKey,
        postingStatus: "POSTED"
      }
    });
    instrumentByClientKey.set(instrument.clientKey, created);
  }
  const allocationByClientKey = new Map<string, any>();
  for (const allocation of preview.allocations) {
    const due = preview.eligibleDues.find((row) => duePositionKey(row) === duePositionKey(allocation));
    if (!due) throw new FamilyCollectionError("Allocation due disappeared during posting", 409);
    const created = await tx.familyStudentAllocation.create({
      data: {
        collectionId: collection.id,
        studentId: due.studentKey,
        academicYear: allocation.academicYear,
        installment: allocation.installment,
        feeHead: allocation.feeHead,
        amountPaise: allocation.amountPaise,
        orderIndex: allocation.orderIndex,
        allocationPolicy: preview.normalizedRequest.allocationMode === "AUTO" ? FAMILY_COLLECTION_POLICY_VERSION : "MANUAL_REVIEWED_V1",
        dueBeforePaise: allocation.dueBeforePaise,
        dueAfterPaise: allocation.dueAfterPaise,
        dueSnapshotHash: allocation.dueSnapshotHash,
        studentNameSnapshot: due.studentName,
        admissionNoSnapshot: due.admissionNo,
        classNameSnapshot: due.className,
        sectionSnapshot: due.section
      }
    });
    allocationByClientKey.set(allocation.clientKey, created);
  }
  for (const share of preview.shares) {
    const allocation = allocationByClientKey.get(share.allocationKey);
    const instrument = instrumentByClientKey.get(share.instrumentKey);
    if (!allocation || !instrument) throw new FamilyCollectionError("Allocation matrix link disappeared during posting", 409);
    const createdShare = await tx.allocationInstrumentShare.create({
      data: { allocationId: allocation.id, instrumentId: instrument.id, amountPaise: share.amountPaise }
    });
    const payment = await tx.payment.create({
      data: {
        date: preview.collectionDate,
        receiptNo: publicReference,
        admissionNo: allocation.admissionNoSnapshot,
        studentId: allocation.studentId,
        studentName: allocation.studentNameSnapshot,
        className: allocation.classNameSnapshot,
        section: allocation.sectionSnapshot,
        amountPaid: rupeesFromPaise(share.amountPaise),
        paymentMode: compatibilityMode(instrument.mode),
        receivedAccount: instrument.receivedAccount,
        transactionRefNo: instrument.referenceMasked,
        feeType: "Current Year Fee",
        termHint: allocation.installment,
        remarks: `Family collection ${publicReference}; governed allocation share`,
        enteredBy: actor.name,
        familyCollectionId: collection.id,
        familyInstrumentId: instrument.id,
        familyAllocationId: allocation.id,
        familyShareId: createdShare.id
      }
    });
    await tx.paymentAudit.create({
      data: {
        paymentId: payment.id,
        action: "FAMILY_COLLECTION_CREATED",
        newValueJson: JSON.stringify(receiptAuditSnapshot(payment)),
        changedByUserId: actor.id,
        changedByName: actor.name,
        reason: "Atomic family collection compatibility posting"
      }
    });
  }
  await tx.receiptNote.create({ data: { receiptNo: publicReference, status: "Active", remarks: "Consolidated family receipt issued" } });
  const receiptSnapshot = familyReceiptSnapshot(publicReference, preview, actor.name, "ISSUED");
  const receiptVersion = await tx.familyReceiptVersion.create({
    data: {
      collectionId: collection.id,
      versionNumber: 1,
      publicVersionReference: `${publicReference}-V1`,
      status: "ISSUED",
      totalPaise: preview.totalPaise,
      snapshotJson: JSON.stringify(receiptSnapshot),
      issuedByUserId: actor.id
    }
  });
  for (const [index, eventType] of ["PREVIEWED", "CONFIRMED", "POSTED", "ISSUED"].entries()) {
    await tx.familyCollectionEvent.create({
      data: {
        collectionId: collection.id,
        eventType,
        previousStatus: index ? ["PREVIEWED", "READY_TO_CONFIRM", "POSTED"][index - 1] : "DRAFT",
        newStatus: ["PREVIEWED", "READY_TO_CONFIRM", "POSTED", "ISSUED"][index],
        collectionVersion: 1,
        actorUserId: actor.id,
        actorName: actor.name,
        reason: index === 0 ? "Reviewed allocation preview persisted with issue" : null,
        detailsJson: JSON.stringify({ planHash: preview.planHash, receiptVersion: receiptVersion.publicVersionReference })
      }
    });
  }
  const providerSnapshot = {
    collectionReference: publicReference,
    collectionVersion: 1,
    amountPaise: preview.totalPaise,
    allocationPlanHash: preview.planHash,
    allocations: preview.allocations.map((row) => ({ admissionNo: row.admissionNo, academicYear: row.academicYear, installment: row.installment, feeHead: row.feeHead, amountPaise: row.amountPaise }))
  };
  await tx.familyProviderAllocationPlan.create({
    data: {
      publicKey: `FPAP-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`,
      collectionId: collection.id,
      planVersion: 1,
      status: "PREPARED",
      amountPaise: preview.totalPaise,
      planHash: canonicalFamilyHash(providerSnapshot),
      snapshotJson: JSON.stringify(providerSnapshot),
      createdByUserId: actor.id
    }
  });
  return loadFamilyCollection(tx, collection.id);
}

async function reverseInTransaction(tx: any, collection: any, reason: string, actor: FamilyActor, targetStatus: "REVERSED" | "SUPERSEDED") {
  const now = new Date();
  const changed = await tx.familyCollection.updateMany({
    where: { id: collection.id, status: "ISSUED", version: collection.version },
    data: { status: targetStatus, version: { increment: 1 }, reversedAt: now, reversedByUserId: actor.id, reversalReason: reason }
  });
  if (changed.count !== 1) throw new FamilyCollectionError("Family collection changed during reversal", 409);
  await tx.familyCollectionInstrument.updateMany({ where: { collectionId: collection.id, postingStatus: "POSTED" }, data: { postingStatus: "REVERSED" } });
  for (const payment of collection.compatibilityPayments) {
    if (payment.isCancelled) continue;
    await tx.payment.update({ where: { id: payment.id }, data: { isCancelled: true, cancelledAt: now, cancelledByUserId: actor.id, cancellationReason: reason } });
    await tx.paymentAudit.create({
      data: {
        paymentId: payment.id,
        action: targetStatus === "SUPERSEDED" ? "FAMILY_COLLECTION_SUPERSEDED" : "FAMILY_COLLECTION_REVERSED",
        oldValueJson: JSON.stringify(receiptAuditSnapshot(payment)),
        newValueJson: JSON.stringify(receiptAuditSnapshot({ ...payment, isCancelled: true, cancelledAt: now, cancellationReason: reason })),
        changedByUserId: actor.id,
        changedByName: actor.name,
        reason
      }
    });
  }
  await tx.receiptNote.update({ where: { receiptNo: collection.publicReference }, data: { status: "Cancelled", remarks: `${targetStatus}: governed family collection compensation` } });
  const latest = collection.receiptVersions[0];
  const versionNumber = collection.currentReceiptVersion + 1;
  const snapshot = latest ? JSON.parse(latest.snapshotJson) : { collectionReference: collection.publicReference };
  await tx.familyReceiptVersion.create({
    data: {
      collectionId: collection.id,
      versionNumber,
      publicVersionReference: `${collection.publicReference}-V${versionNumber}`,
      status: targetStatus,
      totalPaise: collection.totalPaise,
      snapshotJson: JSON.stringify({ ...snapshot, status: targetStatus, reversalReason: reason, reversedAt: now.toISOString() }),
      supersedesVersionId: latest?.id ?? null,
      issuedByUserId: actor.id,
      issuedAt: now
    }
  });
  await tx.familyCollection.update({ where: { id: collection.id }, data: { currentReceiptVersion: versionNumber } });
  await tx.familyCollectionEvent.create({
    data: {
      collectionId: collection.id,
      eventType: targetStatus,
      previousStatus: "ISSUED",
      newStatus: targetStatus,
      collectionVersion: collection.version + 1,
      actorUserId: actor.id,
      actorName: actor.name,
      reason,
      detailsJson: JSON.stringify({ compatibilityPayments: collection.compatibilityPayments.length, instrumentCount: collection.instruments.length })
    }
  });
  if (actor.role === "ACCOUNTANT" && targetStatus === "REVERSED") {
    await publishReceiptLeadershipNotification(tx, {
      eventKey: receiptLeadershipEventKey([collection.publicReference, "FAMILY_REVERSED", collection.version + 1]),
      action: "CANCELLED",
      receiptNo: collection.publicReference,
      amount: rupeesFromPaise(collection.totalPaise),
      receiptDate: collection.collectionDate,
      actor,
      reason,
      versionReference: `${collection.publicReference}-V${versionNumber}`
    });
  }
}

async function resolvePayerAndEligibility(client: FamilyClient, request: ReturnType<typeof normalizePreviewEnvelope>) {
  if (request.payerType === "GUARDIAN") {
    const guardian = await client.guardian.findUnique({
      where: { iamPublicKey: request.guardianKey },
      select: { id: true, iamPublicKey: true, displayName: true, status: true }
    });
    if (!guardian || guardian.status !== "Active") throw new FamilyCollectionError("Active Guardian payer was not found", 404);
    return {
      payerType: "GUARDIAN" as const,
      guardianId: guardian.id,
      guardianKey: guardian.iamPublicKey,
      displayName: guardian.displayName,
      counterpartyReferenceHash: null,
      counterpartyDisplay: null
    };
  }
  const students = await client.student.findMany({
    where: { admissionNo: { in: request.selections.map((row) => row.admissionNo) }, deletedAt: null },
    select: { id: true, guardians: { where: { canViewFees: true, guardian: { status: "Active" } }, select: { guardianId: true } } }
  });
  let common: Set<string> | null = null;
  for (const student of students) {
    const ids = new Set<string>(student.guardians.map((row: any) => String(row.guardianId)));
    if (common == null) common = ids;
    else {
      const previous: Set<string> = common;
      common = new Set<string>(Array.from(previous).filter((id: string) => ids.has(id)));
    }
  }
  if ((!common || !common.size) && !request.auditReason) {
    throw new FamilyCollectionError("An audit reason is required when selected Students do not share one active Guardian relationship");
  }
  return {
    payerType: "COUNTER" as const,
    guardianId: null,
    guardianKey: null,
    displayName: request.counterpartyDisplay!,
    counterpartyReferenceHash: authHashSecret(request.counterpartyReference!, "family-counterparty-reference:v1"),
    counterpartyDisplay: request.counterpartyDisplay
  };
}

async function resolveFamilyDuePositions(client: FamilyClient, selections: Selection[], guardianId: string | null, ignoredCollectionId: string | null) {
  const duePositions: FamilyDuePosition[] = [];
  for (const [selectionIndex, selection] of selections.entries()) {
    const student = await client.student.findUnique({
      where: { admissionNo: selection.admissionNo },
      select: {
        id: true,
        admissionNo: true,
        studentName: true,
        className: true,
        section: true,
        studentType: true,
        discountPercent: true,
        deletedAt: true,
        status: true,
        academicYearEnrollments: { where: { academicYear: selection.academicYear, status: "ACTIVE" }, take: 1 },
        guardians: guardianId ? { where: { guardianId, canViewFees: true }, select: { id: true } } : false
      }
    });
    if (!student || student.deletedAt || student.status !== "Active") throw new FamilyCollectionError("Selected Student is not eligible", 404);
    if (guardianId && !student.guardians.length) throw new FamilyCollectionError("Selected Student is not linked to the active Guardian payer", 403);
    const enrollment = student.academicYearEnrollments[0];
    if (!enrollment) throw new FamilyCollectionError("Selected academic year is not an active supported enrollment", 409);
    const fee = await client.feeStructure.findUnique({ where: { academicYear_className: { academicYear: selection.academicYear, className: enrollment.className } } });
    if (!fee || !fee.active) throw new FamilyCollectionError("No active fee structure supports the selected Student/year", 409);
    const range = academicYearDateRange(selection.academicYear);
    const legacyRows = await client.payment.findMany({
      where: { studentId: student.id, familyCollectionId: null, deletedAt: null, feeType: "Current Year Fee", date: range },
      select: { id: true, receiptNo: true, amountPaid: true, isCancelled: true, deletedAt: true, updatedAt: true }
    });
    const activeLegacy = await effectiveActiveSelectedReceiptPayments(client, legacyRows);
    let legacyPaidPaise = Math.round(activeLegacy.reduce((sum, row) => sum + Number(row.amountPaid), 0) * 100);
    const familyRows = await client.familyStudentAllocation.findMany({
      where: { studentId: student.id, academicYear: selection.academicYear, collectionId: ignoredCollectionId ? { not: ignoredCollectionId } : undefined, collection: { status: "ISSUED" } },
      select: { installment: true, feeHead: true, amountPaise: true }
    });
    const termPaise = Math.round(Number(fee.termAmount) * (1 - effectiveDiscountPercent(student) / 100) * 100);
    for (let term = 1; term <= 4; term += 1) {
      const installment = `Term ${term}` as FamilyDuePosition["installment"];
      const legacyApplied = Math.min(termPaise, Math.max(legacyPaidPaise, 0));
      legacyPaidPaise -= legacyApplied;
      const explicitPaid = familyRows.filter((row: any) => row.installment === installment && row.feeHead === "TUITION").reduce((sum: number, row: any) => sum + row.amountPaise, 0);
      const duePaise = Math.max(termPaise - legacyApplied - explicitPaid, 0);
      if (!duePaise) continue;
      const snapshot = { studentId: student.id, academicYear: selection.academicYear, installment, feeHead: "TUITION", termPaise, legacyApplied, explicitPaid, duePaise };
      duePositions.push({
        studentKey: student.id,
        admissionNo: student.admissionNo,
        studentName: student.studentName,
        className: enrollment.className,
        section: enrollment.section,
        academicYear: selection.academicYear,
        installment,
        feeHead: "TUITION",
        orderIndex: selectionIndex * 4 + term,
        duePaise,
        dueSnapshotHash: canonicalFamilyHash(snapshot)
      });
    }
  }
  if (!duePositions.length) throw new FamilyCollectionError("Selected Students have no supported outstanding dues", 409);
  return duePositions.sort(compareDuePositions);
}

function normalizePreviewEnvelope(raw: unknown) {
  const body = object(raw, "Family collection preview");
  const payerType = String(body.payerType ?? "").toUpperCase();
  if (!['GUARDIAN', 'COUNTER'].includes(payerType)) throw new FamilyCollectionError("Payer type must be GUARDIAN or COUNTER");
  const selections = normalizeSelections(body.students);
  const allocationMode = String(body.allocationMode ?? "AUTO").toUpperCase();
  if (!['AUTO', 'MANUAL'].includes(allocationMode)) throw new FamilyCollectionError("Allocation mode must be AUTO or MANUAL");
  const auditReason = body.auditReason == null || String(body.auditReason).trim() === "" ? null : safeReason(body.auditReason, "Audit reason");
  return {
    payerType: payerType as "GUARDIAN" | "COUNTER",
    guardianKey: payerType === "GUARDIAN" ? boundedKey(body.guardianKey, "Guardian key", 160) : null,
    counterpartyDisplay: payerType === "COUNTER" ? boundedText(body.counterpartyDisplay, "Counterparty display", 120) : null,
    counterpartyReference: payerType === "COUNTER" ? boundedText(body.counterpartyReference, "Counterparty reference", 120) : null,
    collectionDate: localCollectionDate(body.collectionDate),
    selections,
    instruments: body.instruments,
    allocationMode: allocationMode as "AUTO" | "MANUAL",
    allocations: body.allocations,
    shares: body.shares,
    auditReason
    ,correctionOfReference: body.correctionOfReference == null || String(body.correctionOfReference).trim() === "" ? null : boundedReference(body.correctionOfReference)
  };
}

function normalizeSelections(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > FAMILY_COLLECTION_LIMITS.students) {
    throw new FamilyCollectionError(`Select 1 to ${FAMILY_COLLECTION_LIMITS.students} Students`);
  }
  const seen = new Set<string>();
  return value.map((raw) => {
    const row = object(raw, "Student selection");
    const admissionNo = boundedText(row.admissionNo, "Admission number", 80);
    const academicYear = academicYearText(row.academicYear);
    const key = `${admissionNo}|${academicYear}`;
    if (seen.has(key)) throw new FamilyCollectionError("Duplicate Student/year selection is not allowed");
    seen.add(key);
    return { admissionNo, academicYear };
  });
}

function instrumentReferenceMaterial(instruments: FamilyInstrumentInput[]) {
  return instruments.map((row) => {
    if (!requiresFamilyInstrumentReference(row.mode)) return { referenceKey: null, referenceMasked: null };
    const normalized = row.reference!;
    return {
      referenceKey: authHashSecret(normalized, "family-payment-reference:v1"),
      referenceMasked: maskedExternalPaymentReference(row.mode, normalized)
    };
  });
}

async function assertInstrumentReferencesAvailable(client: FamilyClient, references: Array<{ referenceKey: string | null }>) {
  const keys = references.map((row) => row.referenceKey).filter((value): value is string => Boolean(value));
  if (new Set(keys).size !== keys.length) throw new FamilyCollectionError("Duplicate payment references are not allowed", 409);
  if (!keys.length) return;
  const existing = await client.familyCollectionInstrument.findFirst({ where: { referenceKey: { in: keys } }, select: { id: true } });
  if (existing) throw new FamilyCollectionError("A payment reference is already reserved", 409);
}

function remainingByStudent(duePositions: FamilyDuePosition[], allocations: FamilyAllocationInput[]) {
  const allocated = new Map<string, number>();
  for (const row of allocations) {
    const key = `${row.admissionNo}|${row.academicYear}`;
    allocated.set(key, (allocated.get(key) ?? 0) + row.amountPaise);
  }
  const grouped = new Map<string, { admissionNo: string; studentName: string; academicYear: string; remainingPaise: number }>();
  for (const due of duePositions) {
    const key = `${due.admissionNo}|${due.academicYear}`;
    const current = grouped.get(key) ?? { admissionNo: due.admissionNo, studentName: due.studentName, academicYear: due.academicYear, remainingPaise: 0 };
    current.remainingPaise += due.duePaise;
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, row]) => ({ ...row, remainingPaise: row.remainingPaise - (allocated.get(key) ?? 0) }));
}

function familyReceiptSnapshot(reference: string, preview: Awaited<ReturnType<typeof previewFamilyCollection>>, actorName: string, status: string) {
  const instrumentByKey = new Map(preview.instruments.map((row) => [row.clientKey, row]));
  return {
    collectionReference: reference,
    issueReference: `${reference}-V1`,
    status,
    collectionDate: preview.collectionDate.toISOString(),
    payerDisplayName: preview.payer.displayName,
    totalPaise: preview.totalPaise,
    receivedBy: actorName,
    instruments: preview.instruments.map((row) => ({ mode: row.mode, amountPaise: row.amountPaise, receivedAccount: row.receivedAccount, referenceMasked: row.referenceMasked })),
    children: preview.allocations.map((row) => ({
      admissionNo: row.admissionNo,
      studentName: row.studentName,
      className: row.className,
      section: row.section,
      academicYear: row.academicYear,
      installment: row.installment,
      feeHead: row.feeHead,
      amountPaise: row.amountPaise,
      remainingPaise: row.dueAfterPaise,
      instrumentShares: preview.shares.filter((share) => share.allocationKey === row.clientKey).map((share) => ({ mode: instrumentByKey.get(share.instrumentKey)?.mode, amountPaise: share.amountPaise }))
    })),
    remainingByStudent: preview.remainingByStudent,
    allocationPlanHash: preview.planHash,
    familyCreditPaise: 0
  };
}

function serializeFamilyCollection(collection: any) {
  const latestReceipt = collection.receiptVersions.at(-1);
  const receipt = latestReceipt ? JSON.parse(latestReceipt.snapshotJson) : null;
  return {
    publicReference: collection.publicReference,
    receiptReference: collection.receiptReference,
    status: collection.status,
    version: collection.version,
    collectionDate: collection.collectionDate,
    payer: { type: collection.payerType, displayName: collection.payerDisplayName },
    totalPaise: collection.totalPaise,
    creditPaise: collection.creditPaise,
    policyVersion: collection.allocationPolicyVersion,
    planHash: collection.allocationPlanHash,
    replacesReference: collection.replacesCollection?.publicReference ?? null,
    replacedByReference: collection.replacedByCollection?.publicReference ?? null,
    instruments: collection.instruments.map((row: any) => ({ ordinal: row.ordinal, mode: row.mode, amountPaise: row.amountPaise, receivedAccount: row.receivedAccount, referenceMasked: row.referenceMasked, postingStatus: row.postingStatus })),
    allocations: collection.allocations.map((row: any) => ({
      admissionNo: row.admissionNoSnapshot,
      studentName: row.studentNameSnapshot,
      className: row.classNameSnapshot,
      section: row.sectionSnapshot,
      academicYear: row.academicYear,
      installment: row.installment,
      feeHead: row.feeHead,
      amountPaise: row.amountPaise,
      dueBeforePaise: row.dueBeforePaise,
      dueAfterPaise: row.dueAfterPaise,
      shares: row.shares.map((share: any) => ({ amountPaise: share.amountPaise, instrumentOrdinal: collection.instruments.find((instrument: any) => instrument.id === share.instrumentId)?.ordinal }))
    })),
    receipt: receipt ? { ...receipt, issueReference: latestReceipt.publicVersionReference, versionNumber: latestReceipt.versionNumber, status: latestReceipt.status } : null,
    events: collection.events.map((row: any) => ({ type: row.eventType, previousStatus: row.previousStatus, newStatus: row.newStatus, version: row.collectionVersion, actorName: row.actorName, reason: row.reason, createdAt: row.createdAt })),
    providerPlans: collection.providerPlans.map((row: any) => ({ publicKey: row.publicKey, version: row.planVersion, status: row.status, amountPaise: row.amountPaise, planHash: row.planHash }))
  };
}

function childExtract(serialized: any, admissionNo: string) {
  const allocations = serialized.allocations.filter((row: any) => row.admissionNo === admissionNo);
  const allocationTotal = allocations.reduce((sum: number, row: any) => sum + row.amountPaise, 0);
  const childReceipt = serialized.receipt ? {
    ...serialized.receipt,
    payerDisplayName: undefined,
    totalPaise: allocationTotal,
    instruments: undefined,
    children: serialized.receipt.children.filter((row: any) => row.admissionNo === admissionNo),
    remainingByStudent: serialized.receipt.remainingByStudent.filter((row: any) => row.admissionNo === admissionNo),
    authorizationScope: "CHILD_EXTRACT"
  } : null;
  return { ...serialized, payer: undefined, totalPaise: allocationTotal, instruments: [], allocations, receipt: childReceipt, authorizationScope: "CHILD_EXTRACT" };
}

async function assertMutableAccountingDay(tx: any, date: Date, actor: FamilyActor, reference: string, totalPaise: number, reason: string) {
  if (actor.role !== "ACCOUNTANT") return;
  const cashDate = new Date(`${schoolDateKey(date)}T00:00:00.000Z`);
  const day = await tx.cashBookDay.findUnique({ where: { cashDate }, select: { status: true } });
  if (day && !["DRAFT", "REJECTED"].includes(day.status)) {
    throw new FamilyLockedDayError({ actor, reference, totalPaise, date, reason, dayStatus: day.status });
  }
}

async function withLockedDayReview<T>(client: FamilyClient, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof FamilyLockedDayError) {
      const review = error.review;
      await publishReceiptLeadershipNotification(client, {
        eventKey: receiptLeadershipEventKey([review.reference, "FAMILY_LOCKED_DAY", review.dayStatus]),
        action: "LOCKED_DAY_REVIEW",
        receiptNo: review.reference,
        amount: rupeesFromPaise(review.totalPaise),
        receiptDate: review.date,
        actor: review.actor,
        reason: review.reason,
        versionReference: review.dayStatus,
        reconciliationWarning: "Protected Cash Book day requires leadership action"
      });
    }
    throw error;
  }
}

function providerPlanSnapshot(row: any) {
  return {
    collectionReference: row.publicReference,
    collectionVersion: row.version,
    allocationPlanHash: row.allocationPlanHash,
    amountPaise: row.totalPaise,
    allocations: row.allocations.map((allocation: any) => ({ admissionNo: allocation.admissionNoSnapshot, academicYear: allocation.academicYear, installment: allocation.installment, feeHead: allocation.feeHead, amountPaise: allocation.amountPaise }))
  };
}

function normalizedMode(value: string) {
  const upper = value.trim().toUpperCase();
  if (upper === "CASH") return "CASH";
  if (["UPI", "NEFT", "RTGS", "IMPS", "BANK TRANSFER", "CHEQUE", "OTHER"].includes(upper)) return upper;
  throw new FamilyCollectionError("Payment mode is not supported");
}

function compatibilityMode(value: string) {
  const mode = normalizedMode(value);
  if (mode === "CASH") return "Cash";
  if (mode === "BANK TRANSFER") return "Bank Transfer";
  if (mode === "CHEQUE") return "Cheque";
  if (mode === "OTHER") return "Other";
  return mode;
}

function academicYearDateRange(value: string) {
  const startYear = Number(value.slice(0, 4));
  return { gte: new Date(Date.UTC(startYear, 3, 1)), lt: new Date(Date.UTC(startYear + 1, 3, 1)) };
}

function localCollectionDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new FamilyCollectionError("Collection date must use YYYY-MM-DD");
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new FamilyCollectionError("Collection date is invalid");
  return date;
}

function academicYearText(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw new FamilyCollectionError("Academic year must use consecutive YYYY-YY format");
  return text;
}

function newFamilyReference(date: Date) {
  return `FAM-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function boundedReference(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^FAM-\d{8}-[A-Z0-9]{10}$/.test(text)) throw new FamilyCollectionError("Family collection reference is invalid", 404);
  return text;
}

function boundedHash(value: unknown, label: string) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!/^[A-F0-9]{64}$/.test(text)) throw new FamilyCollectionError(`${label} is invalid`);
  return text;
}

function boundedSearch(value: unknown) {
  const text = boundedText(value, "Search", 100);
  if (text.length < 2) throw new FamilyCollectionError("Search requires at least 2 characters");
  return text;
}

function boundedKey(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum || !/^[A-Za-z0-9:_-]+$/.test(text)) throw new FamilyCollectionError(`${label} is invalid`);
  return text;
}

function boundedText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f<>]/.test(text)) throw new FamilyCollectionError(`${label} must be safe text of at most ${maximum} characters`);
  return text;
}

function safeReason(value: unknown, label: string) {
  const text = boundedText(value, label, 500);
  if (text.length < 3) throw new FamilyCollectionError(`${label} must contain at least 3 characters`);
  return text;
}

function positiveInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new FamilyCollectionError(`${label} is invalid`);
  return number;
}

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FamilyCollectionError(`${label} is required`);
  return value as Record<string, any>;
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
