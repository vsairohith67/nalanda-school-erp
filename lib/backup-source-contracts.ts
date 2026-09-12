import contracts from "@/config/backup-source-contracts.json";

export const INTEGRATED_BACKUP_CONTRACT = "NALANDA_RECOVERY_INTEGRATED:v48:certificates-concessions-items";
const certificateKeys = ["certificateRequestCharges", "certificateBulkBatches", "certificateIssueArtifacts"];
const concessionKeys = ["priorYearLiabilities", "priorYearPaymentAttributions", "priorYearConcessionCases", "priorYearIncomeSupports", "priorYearConcessionEvents", "studentItemReceiptSnapshots"];
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function sealIntegratedBackup<T extends { metadata: Record<string, unknown> }>(document: T) {
  const contract = contracts.sources["48"];
  return { ...document, metadata: { ...document.metadata,
    counts: { ...(document.metadata.counts as Record<string, number>),
      ...Object.fromEntries(Object.entries(document).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).length])) },
    schemaFingerprint: contract.schemaFingerprint,
    migrationIdentity: contract.migrationIdentity,
    declaredCollections: Object.keys(document).filter(key => key !== "metadata").sort(),
    artifactRequirements: "INLINE_CERTIFICATE_PDF_SHA256_AND_SNAPSHOT_SHA256:v1"
  } };
}

// Legacy formats never emitted schema fingerprints. Their actual source identities
// are pinned in the registry; the adapter does not pretend that old payloads did.
export function admitBackupSource(root: Record<string, unknown>) {
  const metadata = root.metadata as Record<string, unknown>;
  const version = metadata?.backupVersion;
  if (typeof version !== "number" || ![45, 46, 47, 48].includes(version)) throw new Error("BACKUP_SOURCE_CONTRACT_UNSUPPORTED");
  const source = contracts.sources[String(version) as keyof typeof contracts.sources];
  if (metadata.schemaContract !== (source.discriminator ?? undefined)) throw new Error("BACKUP_SOURCE_DISCRIMINATOR_MISMATCH");
  const declared = Object.keys(root).filter(key => key !== "metadata").sort();
  if (!same(declared, source.collections)) throw new Error("BACKUP_SOURCE_COLLECTIONS_MISMATCH");
  for (const key of source.arrayCollections) if (!Array.isArray(root[key])) throw new Error("BACKUP_SOURCE_COLLECTION_TYPE_MISMATCH");
  if (version !== 48 && ["schemaFingerprint", "migrationIdentity", "declaredCollections", "artifactRequirements"].some(key => key in metadata)) throw new Error("BACKUP_LEGACY_METADATA_MISMATCH");
  if (version === 48 && (!same(metadata.schemaFingerprint, source.schemaFingerprint) ||
    metadata.migrationIdentity !== source.migrationIdentity || !same(metadata.declaredCollections, source.collections) ||
    metadata.artifactRequirements !== "INLINE_CERTIFICATE_PDF_SHA256_AND_SNAPSHOT_SHA256:v1")) throw new Error("BACKUP_INTEGRATED_IDENTITY_MISMATCH");
  const counts = metadata.counts as Record<string, unknown> | undefined;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) throw new Error("BACKUP_SOURCE_COUNTS_REQUIRED");
  if (!same(Object.keys(counts).sort(), source.countKeys)) throw new Error("BACKUP_SOURCE_COUNT_KEYS_MISMATCH");
  if (Object.values(counts).some(value => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) throw new Error("BACKUP_SOURCE_COUNT_INVALID");
  for (const key of source.arrayCollections) {
    if (key in counts && counts[key] !== (root[key] as unknown[]).length) throw new Error("BACKUP_SOURCE_COUNT_MISMATCH");
  }
  if (version === 45 || version === 47) {
    for (const row of (root.studentCertificates as Record<string, unknown>[] ?? [])) {
      if ("workflowKey" in row || "supersedesCertificateId" in row) throw new Error("BACKUP_CERTIFICATE_SOURCE_FIELDS_MISMATCH");
    }
  }
  // The adapters add only collections absent from that exact source contract.
  const adapted = { ...root };
  if (version === 45 || version === 47) for (const key of certificateKeys) adapted[key] = [];
  if (version === 45 || version === 46) for (const key of concessionKeys) adapted[key] = [];
  return { sourceVersion: version, adapted };
}
