import { describe, expect, it } from "vitest";
import contracts from "../config/recovery-source-contracts.json";
import { admitBackupSource, sealIntegratedBackup } from "../lib/backup-source-contracts";

// Pure source-envelope fixtures only: these are not row-validation, database,
// component restore, or operational backup qualification tests.
const versions = [45, 46, 47, 48] as const;
const oldProfiles = ["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH",
  "GENERIC_ADMS_PUSH", "GENERIC_LAN_POLL", "GENERIC_CSV_IMPORT", "SIMULATOR"];
const rawProfile = "ETIMETRACKLITE_RAW_EXPORT_V1";
const refusal = "BACKUP_RAW_EXPORT_REQUIRES_NEW_SOURCE_CONTRACT";
type Envelope = { metadata: Record<string, unknown> } & Record<string, unknown>;

function envelope(version: typeof versions[number], collection?: string, profile?: string): Envelope {
  const source = contracts.sources[String(version) as keyof typeof contracts.sources];
  const root = Object.fromEntries(source.collections.map(key =>
    [key, source.arrayCollections.includes(key) ? [] : null])) as Envelope;
  const counts = Object.fromEntries(source.countKeys.map(key => [key, 0]));
  if (collection) { root[collection] = [{ protocolProfile: profile }]; counts[collection] = 1; }
  root.metadata = { backupVersion: version, schemaContract: source.discriminator ?? undefined, counts };
  if (version === 48) Object.assign(root.metadata, {
    schemaFingerprint: structuredClone(source.schemaFingerprint), migrationIdentity: source.migrationIdentity,
    declaredCollections: [...source.collections], artifactRequirements: "INLINE_CERTIFICATE_PDF_SHA256_AND_SNAPSHOT_SHA256:v1"
  });
  return root;
}

function expectUnchanged(root: Envelope, operation: () => unknown, error?: string) {
  const bytes = JSON.stringify(root);
  if (error) expect(operation).toThrow(error);
  else expect(operation).not.toThrow();
  expect(JSON.stringify(root)).toBe(bytes);
}

describe("raw-export profile cannot acquire a frozen full-backup source identity", () => {
  it.each(versions)("admits empty historical v%s and preserves its adaptation", version => {
    const root = envelope(version);
    expectUnchanged(root, () => {
      const admitted = admitBackupSource(root);
      expect(admitted.sourceVersion).toBe(version);
      expect(admitted.adapted.biometricDevices).toEqual([]);
      expect(admitted.adapted.biometricRawPunches).toEqual([]);
      expect(admitted.adapted.certificateRequestCharges).toEqual([]);
      expect(admitted.adapted.priorYearLiabilities).toEqual([]);
    });
  });

  it.each(oldProfiles)("seals existing profile %s with the unchanged v48 identity", profile => {
    const root = envelope(48, "biometricDevices", profile);
    root.biometricRawPunches = [{ protocolProfile: profile }];
    (root.metadata.counts as Record<string, number>).biometricRawPunches = 1;
    expectUnchanged(root, () => {
      const sealed = sealIntegratedBackup(root);
      expect(sealed.metadata.migrationIdentity).toBe(contracts.sources["48"].migrationIdentity);
      expect(sealed.metadata.schemaFingerprint).toEqual(contracts.sources["48"].schemaFingerprint);
      expect(admitBackupSource(sealed).adapted.biometricRawPunches).toEqual(root.biometricRawPunches);
    });
  });

  it.each(versions.flatMap(version => oldProfiles.map(profile => [version, profile] as const)))(
    "retains v%s admission for existing device and punch profile %s", (version, profile) => {
      const root = envelope(version, "biometricDevices", profile);
      root.biometricRawPunches = [{ protocolProfile: profile }];
      (root.metadata.counts as Record<string, number>).biometricRawPunches = 1;
      expectUnchanged(root, () => admitBackupSource(root));
    });

  it.each(["biometricDevices", "biometricRawPunches"])("refuses %s before assigning frozen v48 metadata", collection => {
    const root = envelope(48, collection, rawProfile);
    delete root.metadata.migrationIdentity;
    delete root.metadata.schemaFingerprint;
    expectUnchanged(root, () => sealIntegratedBackup(root), refusal);
    expect(root.metadata).not.toHaveProperty("migrationIdentity");
  });

  it.each(versions.flatMap(version => ["biometricDevices", "biometricRawPunches"].map(collection =>
    [version, collection] as const)))("refuses forged v%s identity for raw-profile %s", (version, collection) => {
      const root = envelope(version, collection, rawProfile);
      expectUnchanged(root, () => admitBackupSource(root), refusal);
    });

  it("checks every row and both collections without dropping or relabelling raw observations", () => {
    const root = envelope(48, "biometricDevices", "SIMULATOR");
    root.biometricRawPunches = [{ protocolProfile: "SIMULATOR" }, { protocolProfile: rawProfile }];
    (root.metadata.counts as Record<string, number>).biometricRawPunches = 2;
    expectUnchanged(root, () => sealIntegratedBackup(root), refusal);
    expectUnchanged(root, () => admitBackupSource(root), refusal);
  });

  const negatives: Array<[string, 45 | 48, (root: Envelope) => void, string]> = [
    ["unsupported version", 48, r => { r.metadata.backupVersion = 49; }, "BACKUP_SOURCE_CONTRACT_UNSUPPORTED"],
    ["discriminator", 48, r => { r.metadata.schemaContract = "UNSUPPORTED"; }, "BACKUP_SOURCE_DISCRIMINATOR_MISMATCH"],
    ["collections", 48, r => { r.extraCollection = []; }, "BACKUP_SOURCE_COLLECTIONS_MISMATCH"],
    ["array type", 48, r => { r.biometricDevices = {}; }, "BACKUP_SOURCE_COLLECTION_TYPE_MISMATCH"],
    ["legacy metadata", 45, r => { r.metadata.migrationIdentity = "invented"; }, "BACKUP_LEGACY_METADATA_MISMATCH"],
    ["frozen identity", 48, r => { r.metadata.migrationIdentity = "invented"; }, "BACKUP_INTEGRATED_IDENTITY_MISMATCH"],
    ["missing counts", 48, r => { delete r.metadata.counts; }, "BACKUP_SOURCE_COUNTS_REQUIRED"],
    ["count keys", 48, r => { (r.metadata.counts as Record<string, number>).extra = 0; }, "BACKUP_SOURCE_COUNT_KEYS_MISMATCH"],
    ["invalid count", 48, r => { (r.metadata.counts as Record<string, number>).biometricDevices = -1; }, "BACKUP_SOURCE_COUNT_INVALID"],
    ["mismatched count", 48, r => { (r.metadata.counts as Record<string, number>).biometricDevices = 0; }, "BACKUP_SOURCE_COUNT_MISMATCH"],
    ["certificate source fields", 45, r => {
      r.studentCertificates = [{ workflowKey: "invented" }];
      (r.metadata.counts as Record<string, number>).studentCertificates = 1;
    }, "BACKUP_CERTIFICATE_SOURCE_FIELDS_MISMATCH"]
  ];
  it.each(negatives)("preserves existing %s error precedence even with raw-profile rows", (_name, version, mutate, error) => {
    const root = envelope(version, "biometricDevices", rawProfile);
    // Keep another raw-profile collection for the malformed-device-array case.
    root.biometricRawPunches = [{ protocolProfile: rawProfile }];
    (root.metadata.counts as Record<string, number>).biometricRawPunches = 1;
    mutate(root);
    expectUnchanged(root, () => admitBackupSource(root), error);
  });
});
