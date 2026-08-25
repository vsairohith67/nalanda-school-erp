export const OFFLINE_OPERATION_TYPES = ["FEE_PAYMENT", "EXPENSE_DRAFT", "MISC_INCOME"] as const;
export type OfflineOperationType = (typeof OFFLINE_OPERATION_TYPES)[number];

export const OFFLINE_SYNC_OUTCOMES = [
  "ACCEPTED",
  "DUPLICATE_ACCEPTED",
  "CONFLICT",
  "REJECTED",
  "RETRY_LATER"
] as const;
export type OfflineSyncOutcome = (typeof OFFLINE_SYNC_OUTCOMES)[number];

export type OfflineMutationEnvelope = {
  clientMutationId: string;
  localDraftId: string;
  operationType: OfflineOperationType;
  payload: unknown;
  payloadHash: string;
  createdClientAt: string;
  referenceSnapshotVersion: string;
  baseEntityVersion?: string | null;
};

export type OfflineSyncBatch = {
  schemaVersion: 1;
  mutations: OfflineMutationEnvelope[];
};

export function validateOfflineSyncBatch(value: unknown): OfflineSyncBatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("SYNC_BATCH_REQUIRED");
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 1) throw new Error("UNSUPPORTED_SYNC_SCHEMA");
  if (!Array.isArray(row.mutations) || row.mutations.length < 1 || row.mutations.length > 25) throw new Error("SYNC_BATCH_SIZE_INVALID");
  const ids = new Set<string>();
  const mutations = row.mutations.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("SYNC_MUTATION_INVALID");
    const item = raw as Record<string, unknown>;
    const clientMutationId = boundedId(item.clientMutationId, "CLIENT_MUTATION_ID_INVALID");
    const localDraftId = boundedId(item.localDraftId, "LOCAL_DRAFT_ID_INVALID");
    if (ids.has(clientMutationId)) throw new Error("DUPLICATE_CLIENT_MUTATION_ID_IN_BATCH");
    ids.add(clientMutationId);
    const operationType = String(item.operationType ?? "") as OfflineOperationType;
    if (!OFFLINE_OPERATION_TYPES.includes(operationType)) throw new Error("OPERATION_NOT_ALLOWED");
    if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) throw new Error("SYNC_PAYLOAD_INVALID");
    const payloadHash = String(item.payloadHash ?? "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(payloadHash)) throw new Error("PAYLOAD_HASH_INVALID");
    const createdClientAt = String(item.createdClientAt ?? "");
    if (!createdClientAt || Number.isNaN(new Date(createdClientAt).getTime())) throw new Error("CLIENT_TIMESTAMP_INVALID");
    const referenceSnapshotVersion = signedToken(item.referenceSnapshotVersion, "REFERENCE_VERSION_INVALID");
    const baseEntityVersion = item.baseEntityVersion == null ? null : isoTimestamp(item.baseEntityVersion, "BASE_ENTITY_VERSION_INVALID");
    return { clientMutationId, localDraftId, operationType, payload: item.payload, payloadHash, createdClientAt, referenceSnapshotVersion, baseEntityVersion };
  });
  return { schemaVersion: 1, mutations };
}

function signedToken(value: unknown, code: string) {
  const text = String(value ?? "").trim();
  if (text.length > 2048 || !/^[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{32,}$/.test(text)) throw new Error(code);
  return text;
}

function isoTimestamp(value: unknown, code: string) {
  const text = String(value ?? "").trim();
  if (text.length < 20 || text.length > 40 || Number.isNaN(new Date(text).getTime())) throw new Error(code);
  return text;
}

function boundedId(value: unknown, code: string) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(text)) throw new Error(code);
  return text;
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}
