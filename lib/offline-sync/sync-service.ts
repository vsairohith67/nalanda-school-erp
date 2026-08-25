import { Prisma, type OfflineSyncDevice } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { createPaymentReceiptInTransaction } from "@/lib/payment-service";
import { createExpenseDraftInTransaction } from "@/lib/expenses";
import { createMiscReceiptInTransaction } from "@/lib/misc-income";
import { recordOfflineEvent, sha256Hex } from "@/lib/offline-sync/device-trust";
import { stableJson, type OfflineMutationEnvelope, type OfflineSyncOutcome } from "@/lib/offline-sync/contracts";
import { verifyReferenceSnapshot } from "@/lib/offline-sync/reference-packs";
import { offlineSyncRoleAllowed } from "@/lib/offline-sync/feature-flag";

const DOMAIN_PERMISSION = { FEE_PAYMENT: "CREATE_PAYMENTS", EXPENSE_DRAFT: "MANAGE_EXPENSES", MISC_INCOME: "MANAGE_MISC_INCOME" } as const;

type Result = { clientMutationId: string; outcome: OfflineSyncOutcome; code?: string; result?: Record<string, unknown>; retryable?: boolean };

function priorResult(mutation: { clientMutationId: string; status: string; safeResultJson: string | null; conflictCode: string | null; rejectionCode: string | null }): Result {
  if (mutation.status === "ACCEPTED") return { clientMutationId: mutation.clientMutationId, outcome: "DUPLICATE_ACCEPTED", result: mutation.safeResultJson ? JSON.parse(mutation.safeResultJson) : undefined };
  if (mutation.status === "CONFLICT") return { clientMutationId: mutation.clientMutationId, outcome: "CONFLICT", code: mutation.conflictCode ?? "CONFLICT" };
  return { clientMutationId: mutation.clientMutationId, outcome: "REJECTED", code: mutation.rejectionCode ?? "REJECTED" };
}

function matchesIdempotentRequest(
  prior: { payloadHash: string; operationType: string; localDraftId: string; referenceSnapshotVersion: string; baseEntityVersion: string | null },
  item: OfflineMutationEnvelope,
) {
  return prior.payloadHash === item.payloadHash
    && prior.operationType === item.operationType
    && prior.localDraftId === item.localDraftId
    && prior.referenceSnapshotVersion === sha256Hex(item.referenceSnapshotVersion)
    && prior.baseEntityVersion === (item.baseEntityVersion ?? null);
}

function classify(error: unknown): { outcome: "CONFLICT" | "REJECTED"; code: string } {
  const message = error instanceof Error ? error.message : "DOMAIN_VALIDATION_FAILED";
  if (/CHANGED|NO_LONGER|UNAVAILABLE|EXCEEDS_CURRENT_DUE|HARD_EXPIRED|active|rate|found/i.test(message)) return { outcome: "CONFLICT", code: message.slice(0, 120).replace(/[^A-Za-z0-9_-]/g, "_").toUpperCase() };
  return { outcome: "REJECTED", code: message.slice(0, 120).replace(/[^A-Za-z0-9_-]/g, "_").toUpperCase() || "DOMAIN_VALIDATION_FAILED" };
}

async function reauthorize(tx: Prisma.TransactionClient, user: AuthUser, sessionId: string, device: OfflineSyncDevice, permission: string) {
  const freshDevice = await tx.offlineSyncDevice.findUnique({ where: { id: device.id } });
  if (!freshDevice || freshDevice.status !== "ACTIVE" || freshDevice.userId !== user.id || freshDevice.keyVersion !== device.keyVersion) throw new Error("DEVICE_NO_LONGER_ACTIVE");
  if (!offlineSyncRoleAllowed(user.role)) throw new Error("OFFLINE_ROLE_NOT_ALLOWED");
  for (const required of ["USE_OFFLINE_SYNC", permission]) {
    const decision = await evaluateEffectivePermission(tx, { userId: user.id, sessionId, roleAssignmentId: user.roleAssignmentId, permission: required });
    if (!decision.allowed) throw new Error(required === "USE_OFFLINE_SYNC" ? "OFFLINE_PERMISSION_REVOKED" : "DOMAIN_PERMISSION_REVOKED");
    if (decision.role !== "ACCOUNTANT" && decision.role !== "SUPER_ADMIN") throw new Error("OFFLINE_ROLE_NOT_ALLOWED");
  }
}

async function createAuthoritative(tx: Prisma.TransactionClient, item: OfflineMutationEnvelope, user: AuthUser) {
  if (item.operationType === "FEE_PAYMENT") {
    const admissionNo = String((item.payload as Record<string, unknown>).admissionNo ?? "");
    const studentVersion = await tx.student.findUnique({ where: { admissionNo }, select: { updatedAt: true } });
    if (item.baseEntityVersion && studentVersion?.updatedAt.toISOString() !== item.baseEntityVersion) throw new Error("STUDENT_REFERENCE_CHANGED");
    const value = await createPaymentReceiptInTransaction(tx, item.payload, user, { serverReceipt: true, enforceCurrentDue: true, requireActiveStudent: true, requireCurrentYearFee: true });
    return { entityType: "PAYMENT_RECEIPT", entityId: value.rows[0].id, reference: value.receiptNo, result: { receiptNo: value.receiptNo, componentIds: value.rows.map((row) => row.id), status: "ACTIVE" } };
  }
  if (item.operationType === "EXPENSE_DRAFT") {
    const value = await createExpenseDraftInTransaction(tx, item.payload, user);
    return { entityType: "EXPENSE_DRAFT", entityId: value.id, reference: value.expenseNumber, result: { expenseId: value.id, expenseNumber: value.expenseNumber, status: "DRAFT" } };
  }
  const value = await createMiscReceiptInTransaction(tx, item.payload, user.id, { requireExpectedRate: true });
  return { entityType: "MISC_INCOME_RECEIPT", entityId: value.id, reference: value.receiptNumber, result: { receiptId: value.id, receiptNumber: value.receiptNumber, status: value.status } };
}

export async function processOfflineMutation(input: { item: OfflineMutationEnvelope; requestHash: string; device: OfflineSyncDevice; user: AuthUser; sessionId: string }): Promise<Result> {
  const calculatedPayloadHash = sha256Hex(stableJson(input.item.payload));
  if (calculatedPayloadHash !== input.item.payloadHash) return { clientMutationId: input.item.clientMutationId, outcome: "REJECTED", code: "PAYLOAD_HASH_MISMATCH" };
  try {
    return await prisma.$transaction(async (tx) => {
      const prior = await tx.offlineSyncMutation.findUnique({ where: { deviceId_clientMutationId: { deviceId: input.device.id, clientMutationId: input.item.clientMutationId } } });
      if (prior) {
        if (!matchesIdempotentRequest(prior, input.item)) {
          await recordOfflineEvent(tx, { eventType: "IDEMPOTENCY_KEY_REUSE_REJECTED", actorUserId: input.user.id, deviceId: input.device.id, mutationId: prior.id, safeMetadata: { operationType: input.item.operationType } });
          return { clientMutationId: input.item.clientMutationId, outcome: "REJECTED", code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD" };
        }
        return priorResult(prior);
      }
      const ledger = await tx.offlineSyncMutation.create({ data: { deviceId: input.device.id, actorUserId: input.user.id, activeRole: input.user.role, clientMutationId: input.item.clientMutationId, localDraftId: input.item.localDraftId, operationType: input.item.operationType, requestHash: input.requestHash, payloadHash: input.item.payloadHash, syncSchemaVersion: 1, referenceSnapshotVersion: sha256Hex(input.item.referenceSnapshotVersion), baseEntityVersion: input.item.baseEntityVersion ?? null, createdClientAt: new Date(input.item.createdClientAt) } });
      try {
        await reauthorize(tx, input.user, input.sessionId, input.device, DOMAIN_PERMISSION[input.item.operationType]);
        verifyReferenceSnapshot(input.item.referenceSnapshotVersion, input.user.id, input.device.id);
        const created = await createAuthoritative(tx, input.item, input.user);
        await tx.offlineSyncMutation.update({ where: { id: ledger.id }, data: { status: "ACCEPTED", authoritativeEntityType: created.entityType, authoritativeEntityId: created.entityId, authoritativeReference: created.reference, safeResultJson: JSON.stringify(created.result), committedAt: new Date() } });
        await recordOfflineEvent(tx, { eventType: "MUTATION_ACCEPTED", actorUserId: input.user.id, deviceId: input.device.id, mutationId: ledger.id, safeMetadata: { operationType: input.item.operationType } });
        return { clientMutationId: input.item.clientMutationId, outcome: "ACCEPTED", result: created.result };
      } catch (error) {
        const classification = classify(error);
        await tx.offlineSyncMutation.update({ where: { id: ledger.id }, data: { status: classification.outcome, ...(classification.outcome === "CONFLICT" ? { conflictCode: classification.code } : { rejectionCode: classification.code }) } });
        await recordOfflineEvent(tx, { eventType: classification.outcome === "CONFLICT" ? "MUTATION_CONFLICT" : "MUTATION_REJECTED", actorUserId: input.user.id, deviceId: input.device.id, mutationId: ledger.id, safeMetadata: { operationType: input.item.operationType, code: classification.code } });
        return { clientMutationId: input.item.clientMutationId, ...classification };
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const prior = await prisma.offlineSyncMutation.findUnique({ where: { deviceId_clientMutationId: { deviceId: input.device.id, clientMutationId: input.item.clientMutationId } } });
      if (prior) return matchesIdempotentRequest(prior, input.item) ? priorResult(prior) : { clientMutationId: input.item.clientMutationId, outcome: "REJECTED", code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD" };
    }
    return { clientMutationId: input.item.clientMutationId, outcome: "RETRY_LATER", code: "TRANSIENT_SERVER_FAILURE", retryable: true };
  }
}
