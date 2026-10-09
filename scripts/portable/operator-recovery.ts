import { PrismaClient } from "@prisma/client";
import { createManualCloudBackupRun, executeCloudBackupRun } from "../../lib/cloud-backup-worker";
import { verifyStoredCloudBackupArtifact } from "../../lib/cloud-backup-verification";
import { createCloudBackupProvider } from "../../lib/cloud-backup-provider";
import { restoreValidatedBackup } from "../../lib/restore-database";
import { hydratePortableRuntimeSecrets, readPortableSecret } from "../../lib/portable-runtime/secrets";
import { makeRecoveryHandoff, readPrivateRecoveryFile, recoveryHash, validateRecoveryHandoff, type RecoveryExpectation } from "../../lib/portable-runtime/recovery-handoff";
import { assertEmptyRecoveryDatabase, assertRecoveryReadback, assertRecoveryPrivacyKeys } from "../../lib/portable-runtime/recovery-readback";
import { generateFullBackup } from "../../lib/backup";
import {validateOperatorFixture} from "../../lib/portable-runtime/operator-fixture";
import {initializeSyntheticFoundation} from "./synthetic-foundation";

async function main() {
  if (process.env.NALANDA_SYNTHETIC_STAGING !== "true" || process.env.PORTABLE_OPERATOR_CI !== "true") throw Error("SYNTHETIC_RECOVERY_ONLY");
  hydratePortableRuntimeSecrets();
  const [command, operationId, encoded] = process.argv.slice(2);
  if (!/^[a-f0-9]{16}$/.test(operationId ?? "")) throw Error("RECOVERY_OPERATION_INVALID");
  const connection = readPortableSecret(["restore","empty","seed-fixture"].includes(command) ? "DIRECT_URL" : "DATABASE_URL", process.env, { required: true });
  const url = new URL(connection);
  if (url.protocol !== "postgresql:" || url.hostname !== "postgres" || url.pathname !== "/nalanda_portable_synthetic" || url.searchParams.get("schema") !== "public") throw Error("SYNTHETIC_DATABASE_REQUIRED");
  const db = new PrismaClient({ datasourceUrl: connection });
  try {
    if(command==="seed-fixture"){
      const expected=JSON.parse(Buffer.from(encoded??"","base64url").toString());
      const bytes=await readPrivateRecoveryFile("/run/operator-fixture","source-v48.json",16*1024*1024);
      const receipt=JSON.parse((await readPrivateRecoveryFile("/run/operator-fixture","operator-fixture.json",2048)).toString());
      const backup=validateOperatorFixture(bytes,receipt,expected);
      assertRecoveryPrivacyKeys(backup);
      await assertEmptyRecoveryDatabase(db);
      await restoreValidatedBackup(db,backup,{id:"portable-synthetic-director",name:"SYNTHETIC operator fixture preparation"});
      const readback=await assertRecoveryReadback(db,backup);
      await initializeSyntheticFoundation(db);
      console.log(JSON.stringify({state:"GENUINE_NONEMPTY_FIXTURE_INITIALISED",source:expected.source,readback}));return;
    }
    if(command==="empty"){
      await assertEmptyRecoveryDatabase(db);
      const expected=JSON.parse(Buffer.from(encoded??"","base64url").toString());
      const provider=createCloudBackupProvider({providerKind:"OBJECT_STORAGE",liveUseEnabled:true,requestTimeoutMs:30_000});
      if(await provider.headObject(expected.objectKey))throw Error("FAILED_RECOVERY_OBJECT_REMAINS");
      console.log(JSON.stringify({state:"EMPTY_DATABASE_AND_OBJECT_ABSENT"}));return;
    }
    if (command === "inspect") {
      const expected = JSON.parse(Buffer.from(encoded ?? "", "base64url").toString());
      const profile = await db.cloudBackupProfile.findUnique({where:{profileCode:"PORTABLE-SYNTHETIC-S3"}});
      const provider = createCloudBackupProvider({providerKind:"OBJECT_STORAGE",liveUseEnabled:true,requestTimeoutMs:30_000});
      const bytes = await provider.getObject(expected.objectKey);
      if (recoveryHash(bytes) !== expected.objectSha256) throw Error("PRESERVED_BACKUP_CHANGED");
      // Export through the authoritative backup service without writing metadata.
      const snapshot = await generateFullBackup(db, {generatedBy:"SYNTHETIC operator readback",generatedAt:new Date("2026-09-01T00:00:00Z")});
      const value = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
      const business = Object.fromEntries(["students","payments","studentCertificateRequests","studentCertificates","studentCertificateVersions","studentCertificateEvents","certificateRequestCharges","certificateIssueArtifacts","miscIncomeReceipts","miscIncomeReceiptLines","studentItemReceiptSnapshots","priorYearLiabilities","priorYearPaymentAttributions","priorYearConcessionCases","priorYearIncomeSupports","priorYearConcessionEvents"].map(k=>[k,(value as any)[k]]));
      const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
      console.log(JSON.stringify({state:"INSPECTED",businessSha256:recoveryHash(JSON.stringify(canonical(business))),objectSha256:recoveryHash(bytes),profileActive:profile?.liveUseEnabled ?? false}));
      return;
    }
    if (command === "backup") {
      const identity = JSON.parse(Buffer.from(encoded ?? "", "base64url").toString());
      if (!/^nalanda-ci-[a-z0-9-]{3,64}$/.test(identity.sourceProject) || !/^[a-f0-9]{40}$/.test(identity.sourceCommit) || !/^\d+$/.test(identity.runId) || !/^\d+$/.test(identity.attempt)) throw Error("BACKUP_IDENTITY_INVALID");
      const profile = await db.cloudBackupProfile.findUnique({ where: { profileCode: "PORTABLE-SYNTHETIC-S3" } });
      if (!profile || profile.status !== "ACTIVE" || profile.providerKind !== "OBJECT_STORAGE") throw Error("EXPLICIT_SYNTHETIC_PROFILE_REQUIRED");
      const run = await createManualCloudBackupRun(db, profile.id, "portable-synthetic-director");
      let result = await executeCloudBackupRun(db, run.id);
      const deadline = Date.now() + 10 * 60_000;
      while (!["VERIFIED", "FAILED"].includes(result.status) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const polled = await db.cloudBackupRun.findUnique({ where: { id: run.id } });
        if (!polled) throw Error("BACKUP_RUN_MISSING");
        result = polled;
      }
      const artifact = await db.cloudBackupArtifact.findFirst({ where: { runId: run.id, status: "VERIFIED" } });
      if (result.status !== "VERIFIED" || !artifact || artifact.privateAssetsIncluded) throw Error("BACKUP_NOT_VERIFIED");
      const verification = await verifyStoredCloudBackupArtifact(db, artifact.id);
      if (!verification.verified || verification.backupVersion !== 48) throw Error("BACKUP_READBACK_FAILED");
      const bytes = await createCloudBackupProvider(profile).getObject(artifact.objectKeySafe);
      // Private pipe only. The parent strips transfer bytes from public receipts.
      if (bytes.length > 2 * 1024 * 1024) throw Error("OPERATOR_HANDOFF_BOUND_EXCEEDED");
      const manifest = makeRecoveryHandoff(bytes, { ...identity, artifactId: artifact.id, objectKey: artifact.objectKeySafe });
      console.log(JSON.stringify({ state: "VERIFIED", operationId, id: artifact.id, ciphertextSha256: artifact.ciphertextSha256, backupVersion: 48, transfer: { manifest, container: bytes.toString("base64") } }));
      return;
    }
    if (command !== "restore" || !encoded || encoded.length > 8192) throw Error("RESTORE_INPUT_INVALID");
    const expected = JSON.parse(Buffer.from(encoded, "base64url").toString()) as RecoveryExpectation;
    const bytes = await readPrivateRecoveryFile("/run/recovery", "backup.npsbackup", 2 * 1024 * 1024);
    const manifest = await readPrivateRecoveryFile("/run/recovery", "manifest.json", 8192);
    const keyText = (await readPrivateRecoveryFile("/run/recovery-key", "recovery-key", 128)).toString().trim();
    if (!/^[A-Za-z0-9+/]{43}=$/.test(keyText)) throw Error("RECOVERY_KEY_INVALID");
    const key = Buffer.from(keyText, "base64");
    let validated;
    try { validated = await validateRecoveryHandoff(bytes, manifest, key, expected); } finally { key.fill(0); }
    assertRecoveryPrivacyKeys(validated.backup);
    await assertEmptyRecoveryDatabase(db);
    // Destination S3 credentials only: no source connection or fake catalogue.
    const provider = createCloudBackupProvider({ providerKind: "OBJECT_STORAGE", liveUseEnabled: true, requestTimeoutMs: 30_000 });
    if (await provider.headObject(validated.manifest.objectKey)) throw Error("RECOVERY_OBJECT_COLLISION");
    await provider.putObject(validated.manifest.objectKey, bytes);
    if (recoveryHash(await provider.getObject(validated.manifest.objectKey)) !== expected.objectSha256) throw Error("RECOVERY_OBJECT_READBACK_FAILED");
    await restoreValidatedBackup(db, validated.backup, { id: "portable-synthetic-director", name: "SYNTHETIC independent recovery" });
    const readback = await assertRecoveryReadback(db, validated.backup);
    console.log(JSON.stringify({ state: "RESTORED", operationId, ciphertextSha256: validated.manifest.ciphertextSha256, objectSha256: expected.objectSha256, backupVersion: 48, emptyTargetReserved: true, existingDataOverwritten: false, readback }));
    // Preserve ambiguous effects for reconciliation, never blindly replay.
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("OPERATOR_RECOVERY_FAILED"); process.exitCode = 1; });
