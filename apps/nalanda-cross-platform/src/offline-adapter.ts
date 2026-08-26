import { decryptRecord, encryptRecord } from "./crypto";
import { deleteEnvelope, listEnvelopes, storeEnvelope, type VaultSession } from "./native";
import type { LocalDraft } from "./domain";

export type OfflineMutationEnvelope = {
  clientMutationId: string;
  localDraftId: string;
  operationType: LocalDraft["type"];
  payload: Record<string, unknown>;
  payloadHash: string;
  createdClientAt: string;
  referenceSnapshotVersion: string;
  baseEntityVersion: string | null;
};

export type AcceptedResult = { clientMutationId: string; acceptedAt: string; safeResult: Record<string, unknown> | null };
export type ReferencePack = {
  schemaVersion: 1;
  snapshotVersion: string;
  generatedAt: string;
  softStaleAt: string;
  hardExpiresAt: string;
  cursor: string;
  students: Array<{ id: string; admissionNo: string; name: string; academicYear: string; entityVersion: string }>;
  vendors: Array<{ id: string; code: string; name: string; entityVersion: string }>;
  expenseCategories: Array<{ id: string; code: string; name: string; entityVersion: string }>;
  expenseDepartments: Array<{ id: string; code: string; name: string; entityVersion: string }>;
  miscIncomeItems: Array<{ id: string; code: string; name: string; studentLinkPolicy: string; entityVersion: string; rates: Array<{ id: string; academicYear: string; amount: string; entityVersion: string }> }>;
};

export interface DraftStore { put(value: LocalDraft): Promise<void>; list(): Promise<LocalDraft[]>; remove(id: string): Promise<void>; }
export interface OutboxStore { put(value: OfflineMutationEnvelope): Promise<void>; list(): Promise<OfflineMutationEnvelope[]>; remove(id: string): Promise<void>; }
export interface ReferenceSnapshotStore { put(value: ReferencePack): Promise<void>; current(): Promise<ReferencePack | null>; }
export interface SyncCursorStore { put(value: string): Promise<void>; current(): Promise<string | null>; }
export interface DeviceKeyStore { deviceId(): Promise<string>; publicKey(): Promise<Record<string, unknown>>; sign(message: string): Promise<string>; }
export interface AcceptedResultStore { put(value: AcceptedResult): Promise<void>; list(): Promise<AcceptedResult[]>; }

const TYPES = {
  draft: "finance-draft",
  outbox: "sync-outbox",
  reference: "reference-pack",
  cursor: "sync-cursor",
  accepted: "accepted-result"
} as const;

class EncryptedStore<T> {
  constructor(private readonly vault: VaultSession, private readonly recordType: string) {}
  private recordId(id: string) { return `${this.recordType}:${id}`; }
  async put(id: string, value: T) {
    await storeEnvelope(await encryptRecord({ recordId: this.recordId(id), recordType: this.recordType, value, key: await this.vault.contentKey() }));
  }
  async list() {
    const key = await this.vault.contentKey();
    return Promise.all((await listEnvelopes(this.recordType)).map((envelope) => decryptRecord<T>({ envelope, key })));
  }
  async remove(id: string) { await deleteEnvelope(this.recordId(id)); }
}

export class NativeOfflineStorageAdapter {
  readonly drafts: DraftStore;
  readonly outbox: OutboxStore;
  readonly references: ReferenceSnapshotStore;
  readonly cursors: SyncCursorStore;
  readonly deviceKeys: DeviceKeyStore;
  readonly acceptedResults: AcceptedResultStore;

  constructor(vault: VaultSession) {
    const drafts = new EncryptedStore<LocalDraft>(vault, TYPES.draft);
    const outbox = new EncryptedStore<OfflineMutationEnvelope>(vault, TYPES.outbox);
    const references = new EncryptedStore<ReferencePack>(vault, TYPES.reference);
    const cursors = new EncryptedStore<string>(vault, TYPES.cursor);
    const accepted = new EncryptedStore<AcceptedResult>(vault, TYPES.accepted);
    this.drafts = { put: (value) => drafts.put(value.id, value), list: () => drafts.list(), remove: (id) => drafts.remove(id) };
    this.outbox = { put: (value) => outbox.put(value.clientMutationId, value), list: () => outbox.list(), remove: (id) => outbox.remove(id) };
    this.references = { put: (value) => references.put("current", value), current: async () => (await references.list())[0] ?? null };
    this.cursors = { put: (value) => cursors.put("current", value), current: async () => (await cursors.list())[0] ?? null };
    this.deviceKeys = { deviceId: () => vault.deviceId(), publicKey: () => vault.publicSigningJwk(), sign: (message) => vault.sign(message) };
    this.acceptedResults = { put: (value) => accepted.put(value.clientMutationId, value), list: () => accepted.list() };
  }
}
