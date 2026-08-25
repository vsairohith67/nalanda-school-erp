"use client";

import { stableJson, type OfflineMutationEnvelope, type OfflineOperationType } from "@/lib/offline-sync/contracts";
import { decryptLocalRecord, encryptLocalRecord, purgeEncryptedRecord } from "@/lib/offline-sync/client/crypto";
import { listLocal, type EncryptedLocalRecord } from "@/lib/offline-sync/client/database";
import { sha256, signedFetch } from "@/lib/offline-sync/client/device";
import { announceOfflineState, withOfflineSyncLock } from "@/lib/offline-sync/client/coordinator";

export const OFFLINE_EDITING_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const OFFLINE_QUEUED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const OFFLINE_ACCEPTED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type LocalDraft = { id: string; operationType: OfflineOperationType; payload: Record<string, unknown>; referenceSnapshotVersion: string; baseEntityVersion?: string | null; createdAt: string; updatedAt: string; state: "EDITING" | "QUEUED" | "CONFLICT" | "REJECTED" };
type ReferenceTombstones = { students: string[]; feeStructures: string[]; vendors: string[]; expenseCategories: string[]; expenseDepartments: string[]; miscIncomeItems: string[] };
export type ReferencePack = { snapshotVersion: string; cursor: string; softStaleAt: string; hardExpiresAt: string; students: unknown[]; feeStructures: unknown[]; vendors: unknown[]; expenseCategories: unknown[]; expenseDepartments: unknown[]; miscIncomeItems: unknown[]; tombstones?: ReferenceTombstones; dictionaries: Record<string, string[]>; generatedAt: string; mode: string };

export async function privateConnectivityCheck() {
  try { const response = await fetch("/api/auth/context", { cache: "no-store", credentials: "same-origin" }); return response.ok; }
  catch { return false; }
}

export async function refreshReferencePack() {
  const existing = (await listLocal<EncryptedLocalRecord>("references")).find((row) => row.id === "current");
  let previous: ReferencePack | null = null;
  if (existing) previous = await decryptLocalRecord<ReferencePack>("references", existing);
  const path = previous?.cursor ? `/api/offline-sync/reference-pack?cursor=${encodeURIComponent(previous.cursor)}` : "/api/offline-sync/reference-pack";
  const response = await signedFetch(path);
  const next = await response.json(); if (!response.ok) throw new Error(next.error ?? "Unable to refresh the offline reference pack.");
  const merged = previous && next.mode === "INCREMENTAL" ? mergeReferencePack(previous, next) : next;
  await encryptLocalRecord("references", "current", merged, { expiresAt: new Date(merged.hardExpiresAt).getTime() });
  return merged as ReferencePack;
}

function mergeReferencePack(previous: ReferencePack, next: ReferencePack): ReferencePack {
  const merge = (left: any[], right: any[], removed: string[] = []) => [...new Map([...left.filter((row) => !removed.includes(row.id)), ...right].map((row) => [row.id, row])).values()];
  return { ...next, students: merge(previous.students, next.students, next.tombstones?.students), feeStructures: merge(previous.feeStructures, next.feeStructures, next.tombstones?.feeStructures), vendors: merge(previous.vendors, next.vendors, next.tombstones?.vendors), expenseCategories: merge(previous.expenseCategories, next.expenseCategories, next.tombstones?.expenseCategories), expenseDepartments: merge(previous.expenseDepartments, next.expenseDepartments, next.tombstones?.expenseDepartments), miscIncomeItems: merge(previous.miscIncomeItems, next.miscIncomeItems, next.tombstones?.miscIncomeItems) };
}

export async function currentReferencePack() {
  const record = (await listLocal<EncryptedLocalRecord>("references")).find((row) => row.id === "current");
  return record ? decryptLocalRecord<ReferencePack>("references", record) : null;
}

export async function saveDraft(input: { id?: string; operationType: OfflineOperationType; payload: Record<string, unknown>; baseEntityVersion?: string | null }) {
  const references = await currentReferencePack(); if (!references) throw new Error("Refresh the approved reference pack before preparing drafts.");
  if (Date.now() >= new Date(references.hardExpiresAt).getTime()) throw new Error("The offline reference pack expired. Reconnect and refresh it.");
  const now = new Date().toISOString(); const id = input.id ?? crypto.randomUUID();
  const draft: LocalDraft = { id, operationType: input.operationType, payload: input.payload, referenceSnapshotVersion: references.snapshotVersion, baseEntityVersion: input.baseEntityVersion, createdAt: now, updatedAt: now, state: "EDITING" };
  await encryptLocalRecord("drafts", id, draft, { status: draft.state, operationType: draft.operationType, expiresAt: Date.now() + OFFLINE_EDITING_RETENTION_MS });
  announceOfflineState({ pending: true }); return draft;
}

export async function queueDraft(id: string) {
  const encrypted = (await listLocal<EncryptedLocalRecord>("drafts")).find((row) => row.id === id); if (!encrypted) throw new Error("Draft not found.");
  const draft = await decryptLocalRecord<LocalDraft>("drafts", encrypted);
  const envelope: OfflineMutationEnvelope = { clientMutationId: crypto.randomUUID(), localDraftId: draft.id, operationType: draft.operationType, payload: draft.payload, payloadHash: await sha256(stableJson(draft.payload)), createdClientAt: draft.createdAt, referenceSnapshotVersion: draft.referenceSnapshotVersion, baseEntityVersion: draft.baseEntityVersion };
  const expiresAt = Date.now() + OFFLINE_QUEUED_RETENTION_MS;
  await encryptLocalRecord("outbox", envelope.clientMutationId, envelope, { status: "QUEUED", operationType: envelope.operationType, expiresAt });
  await encryptLocalRecord("drafts", draft.id, { ...draft, state: "QUEUED", updatedAt: new Date().toISOString() }, { status: "QUEUED", operationType: draft.operationType, expiresAt });
  announceOfflineState({ pending: true }); return envelope.clientMutationId;
}

export async function listDrafts() {
  const rows = await listLocal<EncryptedLocalRecord>("drafts");
  return Promise.all(rows.map((row) => decryptLocalRecord<LocalDraft>("drafts", row)));
}

export async function syncOutbox() {
  return withOfflineSyncLock(async () => {
    if (!(await privateConnectivityCheck())) throw new Error("The private server health check is unavailable. Drafts remain encrypted on this device.");
    const rows = (await listLocal<EncryptedLocalRecord>("outbox")).filter((row) => ["QUEUED", "RETRY_LATER"].includes(row.status ?? ""));
    const envelopes = await Promise.all(rows.slice(0, 25).map((row) => decryptLocalRecord<OfflineMutationEnvelope>("outbox", row)));
    if (!envelopes.length) return { results: [] };
    const body = JSON.stringify({ schemaVersion: 1, mutations: envelopes });
    const response = await signedFetch("/api/offline-sync/sync", { method: "POST", body }); const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to synchronize offline drafts.");
    for (const outcome of result.results as Array<{ clientMutationId: string; outcome: string; result?: unknown; code?: string }>) {
      const envelope = envelopes.find((row) => row.clientMutationId === outcome.clientMutationId); if (!envelope) continue;
      const outboxRow = rows.find((row) => row.id === outcome.clientMutationId);
      if (outcome.outcome === "ACCEPTED" || outcome.outcome === "DUPLICATE_ACCEPTED") {
        await encryptLocalRecord("accepted", outcome.clientMutationId, { acceptedAt: new Date().toISOString(), operationType: envelope.operationType, result: outcome.result }, { status: "ACCEPTED", operationType: envelope.operationType, expiresAt: Date.now() + OFFLINE_ACCEPTED_RETENTION_MS });
        await purgeEncryptedRecord("outbox", outcome.clientMutationId); await purgeEncryptedRecord("drafts", envelope.localDraftId);
      } else {
        const expiresAt = outboxRow?.expiresAt ?? Date.now() + OFFLINE_QUEUED_RETENTION_MS;
        await encryptLocalRecord("outbox", outcome.clientMutationId, { ...envelope, lastOutcome: outcome }, { status: outcome.outcome, operationType: envelope.operationType, expiresAt });
        const draftRow = (await listLocal<EncryptedLocalRecord>("drafts")).find((row) => row.id === envelope.localDraftId);
        if (draftRow) {
          const draft = await decryptLocalRecord<LocalDraft>("drafts", draftRow);
          const state = outcome.outcome === "CONFLICT" ? "CONFLICT" : outcome.outcome === "RETRY_LATER" ? "QUEUED" : "REJECTED";
          await encryptLocalRecord("drafts", draft.id, { ...draft, state, updatedAt: new Date().toISOString() }, { status: outcome.outcome, operationType: draft.operationType, expiresAt: draftRow.expiresAt ?? expiresAt });
        }
      }
    }
    announceOfflineState({ pending: (await listLocal("outbox")).length > 0 }); return result;
  });
}

export async function purgeExpiredLocalRecords(now = Date.now()) {
  for (const store of ["drafts", "outbox", "references", "accepted"] as const) {
    const rows = await listLocal<EncryptedLocalRecord>(store);
    for (const row of rows) if (!Number.isFinite(row.expiresAt) || row.expiresAt! <= now) await purgeEncryptedRecord(store, row.id);
  }
}
