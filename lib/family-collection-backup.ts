import type { PrismaClient } from "@prisma/client";

export const FAMILY_COLLECTION_BACKUP_KEYS = [
  "familyCollections",
  "familyCollectionInstruments",
  "familyStudentAllocations",
  "allocationInstrumentShares",
  "familyReceiptVersions",
  "familyCollectionEvents",
  "familyProviderAllocationPlans"
] as const;

export type FamilyCollectionBackupKey = (typeof FAMILY_COLLECTION_BACKUP_KEYS)[number];
export type FamilyCollectionBackup = Record<FamilyCollectionBackupKey, Array<Record<string, unknown>>>;

export function emptyFamilyCollectionBackup(): FamilyCollectionBackup {
  return Object.fromEntries(FAMILY_COLLECTION_BACKUP_KEYS.map((key) => [key, []])) as unknown as FamilyCollectionBackup;
}

export async function familyCollectionSchemaAvailable(client: PrismaClient | any) {
  const query = (client as any).$queryRawUnsafe;
  if (typeof query !== "function") return Boolean((client as any).familyCollection?.findMany);
  const rows = await query.call(client, `PRAGMA table_info("FamilyCollection")`) as unknown[];
  return rows.length > 0;
}

export async function loadFamilyCollectionBackup(client: PrismaClient | any): Promise<FamilyCollectionBackup> {
  const db = client as any;
  const [
    familyCollections,
    familyCollectionInstruments,
    familyStudentAllocations,
    allocationInstrumentShares,
    familyReceiptVersions,
    familyCollectionEvents,
    familyProviderAllocationPlans
  ] = await Promise.all([
    db.familyCollection.findMany({ orderBy: [{ collectionDate: "asc" }, { createdAt: "asc" }] }),
    db.familyCollectionInstrument.findMany({ orderBy: [{ collectionId: "asc" }, { ordinal: "asc" }] }),
    db.familyStudentAllocation.findMany({ orderBy: [{ collectionId: "asc" }, { orderIndex: "asc" }] }),
    db.allocationInstrumentShare.findMany({ orderBy: [{ allocationId: "asc" }, { instrumentId: "asc" }] }),
    db.familyReceiptVersion.findMany({ orderBy: [{ collectionId: "asc" }, { versionNumber: "asc" }] }),
    db.familyCollectionEvent.findMany({ orderBy: [{ collectionId: "asc" }, { createdAt: "asc" }] }),
    db.familyProviderAllocationPlan.findMany({ orderBy: [{ collectionId: "asc" }, { planVersion: "asc" }] })
  ]);
  return validateFamilyCollectionBackupRows({ familyCollections, familyCollectionInstruments, familyStudentAllocations, allocationInstrumentShares, familyReceiptVersions, familyCollectionEvents, familyProviderAllocationPlans });
}

export function validateFamilyCollectionBackupRows(input: Record<string, unknown>): FamilyCollectionBackup {
  const backup = Object.fromEntries(FAMILY_COLLECTION_BACKUP_KEYS.map((key) => [key, rows(input[key], key)])) as unknown as FamilyCollectionBackup;
  const collections = new Map(backup.familyCollections.map((row) => [text(row.id, "collection id"), row]));
  const instruments = new Map(backup.familyCollectionInstruments.map((row) => [text(row.id, "instrument id"), row]));
  const allocations = new Map(backup.familyStudentAllocations.map((row) => [text(row.id, "allocation id"), row]));
  const receipts = new Map(backup.familyReceiptVersions.map((row) => [text(row.id, "receipt version id"), row]));
  for (const row of backup.familyCollectionInstruments) requireLink(collections, row.collectionId, "instrument collection");
  for (const row of backup.familyStudentAllocations) requireLink(collections, row.collectionId, "allocation collection");
  for (const row of backup.allocationInstrumentShares) {
    requireLink(allocations, row.allocationId, "share allocation");
    requireLink(instruments, row.instrumentId, "share instrument");
    positivePaise(row.amountPaise, "share amount");
  }
  for (const row of backup.familyReceiptVersions) {
    requireLink(collections, row.collectionId, "receipt collection");
    if (row.supersedesVersionId != null) requireLink(receipts, row.supersedesVersionId, "superseded receipt version");
    JSON.parse(text(row.snapshotJson, "receipt snapshot"));
  }
  for (const row of backup.familyCollectionEvents) requireLink(collections, row.collectionId, "event collection");
  for (const row of backup.familyProviderAllocationPlans) {
    requireLink(collections, row.collectionId, "provider-plan collection");
    JSON.parse(text(row.snapshotJson, "provider plan snapshot"));
  }
  for (const [collectionId, collection] of collections) {
    const total = positivePaise(collection.totalPaise, "collection total");
    if (Number(collection.creditPaise ?? 0) !== 0) throw new Error("Family credit must remain zero in backup version 37");
    const instrumentRows = backup.familyCollectionInstruments.filter((row) => row.collectionId === collectionId);
    const allocationRows = backup.familyStudentAllocations.filter((row) => row.collectionId === collectionId);
    const instrumentTotal = instrumentRows.reduce((sum, row) => sum + positivePaise(row.amountPaise, "instrument amount"), 0);
    const allocationTotal = allocationRows.reduce((sum, row) => sum + positivePaise(row.amountPaise, "allocation amount"), 0);
    if (instrumentTotal !== total || allocationTotal !== total) throw new Error(`Family collection ${String(collection.publicReference)} does not reconcile in backup`);
    for (const instrument of instrumentRows) {
      const shares = backup.allocationInstrumentShares.filter((row) => row.instrumentId === instrument.id).reduce((sum, row) => sum + Number(row.amountPaise), 0);
      if (shares !== Number(instrument.amountPaise)) throw new Error("Family instrument shares do not reconcile in backup");
    }
    for (const allocation of allocationRows) {
      const shares = backup.allocationInstrumentShares.filter((row) => row.allocationId === allocation.id).reduce((sum, row) => sum + Number(row.amountPaise), 0);
      if (shares !== Number(allocation.amountPaise)) throw new Error("Family allocation shares do not reconcile in backup");
    }
  }
  return backup;
}

function rows(value: unknown, label: string) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${label}[${index}] must be an object`);
    return { ...(row as Record<string, unknown>) };
  });
}

function text(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result || result.length > 100_000) throw new Error(`${label} is invalid`);
  return result;
}

function positivePaise(value: unknown, label: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${label} must be positive integer paise`);
  return result;
}

function requireLink(map: Map<string, Record<string, unknown>>, value: unknown, label: string) {
  if (!map.has(text(value, label))) throw new Error(`${label} is missing`);
}
