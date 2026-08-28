import { createHash, timingSafeEqual } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { previewCloudBackupRetention, pruneCloudBackupRetention } from "@/lib/cloud-backup-retention";

const prisma = new PrismaClient();
const mode = process.argv[2];

function snapshot(preview: Awaited<ReturnType<typeof previewCloudBackupRetention>>) {
  return {
    schemaVersion: 1,
    profileId: preview.profileId,
    policy: preview.policy,
    postPruneVerifiedCopyCount: preview.postPruneVerifiedCopyCount,
    canPrune: preview.canPrune,
    rows: preview.rows.map((row) => ({
      runId: row.runId,
      artifactId: row.artifactId,
      artifactStatus: row.artifactStatus,
      objectKeySafe: row.objectKeySafe,
      providerObjectVersionSafe: row.providerObjectVersionSafe,
      verified: row.verified,
      retainedReason: row.retainedReason,
      eligibleReason: row.eligibleReason,
      eligible: row.eligible
    })).sort((left, right) => left.artifactId.localeCompare(right.artifactId))
  };
}

function digest(plan: ReturnType<typeof snapshot>) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function compatibleWithAuthorisedPlan(current: ReturnType<typeof snapshot>, authorised: ReturnType<typeof snapshot>) {
  if (digest(current) === digest(authorised)) return true;
  if (current.profileId !== authorised.profileId || JSON.stringify(current.policy) !== JSON.stringify(authorised.policy) ||
    current.postPruneVerifiedCopyCount !== authorised.postPruneVerifiedCopyCount || current.canPrune !== authorised.canPrune ||
    current.rows.length !== authorised.rows.length) return false;
  const currentByArtifact = new Map(current.rows.map((row) => [row.artifactId, row]));
  return authorised.rows.every((planned) => {
    const row = currentByArtifact.get(planned.artifactId);
    if (!row || row.runId !== planned.runId || row.objectKeySafe !== planned.objectKeySafe ||
      row.providerObjectVersionSafe !== planned.providerObjectVersionSafe) return false;
    if (planned.eligible && row.artifactStatus === "PRUNED" && !row.eligible) return true;
    return JSON.stringify(row) === JSON.stringify(planned);
  });
}

async function activeProfileId(client: any) {
  const profile = await client.cloudBackupProfile.findFirst({
    where: { status: "ACTIVE", providerKind: "OBJECT_STORAGE", liveUseEnabled: true },
    orderBy: { profileCode: "asc" }
  });
  if (!profile) throw new Error("PORTABLE_RETENTION_PROFILE_MISSING");
  return profile.id as string;
}

async function readAuthorisedPlan() {
  const expectedPath = "/run/maintenance/retention-plan.json";
  const stat = await lstat(expectedPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 2 * 1024 * 1024) {
    throw new Error("PORTABLE_RETENTION_PLAN_FILE_INVALID");
  }
  if (await realpath(expectedPath) !== expectedPath) throw new Error("PORTABLE_RETENTION_PLAN_PATH_INVALID");
  const parsed = JSON.parse(await readFile(expectedPath, "utf8")) as { plan?: ReturnType<typeof snapshot>; sha256?: string };
  if (!parsed.plan || !/^[a-f0-9]{64}$/.test(parsed.sha256 ?? "")) throw new Error("PORTABLE_RETENTION_PLAN_INVALID");
  const calculated = digest(parsed.plan);
  const authorised = process.env.PORTABLE_RETENTION_PLAN_SHA256?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(authorised) || !timingSafeEqual(Buffer.from(authorised), Buffer.from(calculated)) || calculated !== parsed.sha256) {
    throw new Error("PORTABLE_RETENTION_PLAN_NOT_AUTHORISED");
  }
  return parsed.plan;
}

async function main() {
  if (mode === "plan") {
    const profileId = await activeProfileId(prisma);
    const plan = snapshot(await previewCloudBackupRetention(prisma, profileId));
    console.log(JSON.stringify({ result: "PORTABLE_RETENTION_PLAN_ONLY", plan, sha256: digest(plan), deletesPerformed: 0 }));
    return;
  }
  if (mode !== "apply") throw new Error("PORTABLE_RETENTION_MAINTENANCE_MODE_INVALID");
  const authorisedPlan = await readAuthorisedPlan();
  const authorisedExactVersions = new Set(authorisedPlan.rows.filter((row) => row.eligible).map((row) =>
    `${row.artifactId}:${row.objectKeySafe}:${row.providerObjectVersionSafe}`
  ));
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      'LOCK TABLE "CloudBackupProfile", "CloudBackupRetentionPolicy", "CloudBackupRun", "CloudBackupArtifact", "CloudBackupRestoreRehearsal", "CloudBackupEvent" IN SHARE MODE'
    );
    const profileId = await activeProfileId(transaction);
    const current = snapshot(await previewCloudBackupRetention(transaction as any, profileId));
    if (!compatibleWithAuthorisedPlan(current, authorisedPlan)) throw new Error("PORTABLE_RETENTION_PLAN_STATE_CHANGED");
    await transaction.cloudBackupEvent.create({
      data: {
        profileId,
        eventType: "RETENTION_PLAN_AUTHORISED",
        safeMetadataJson: JSON.stringify({ planSha256: digest(authorisedPlan), exactVersionCount: authorisedExactVersions.size })
      }
    });
  }, { maxWait: 10_000, timeout: 60_000 });
  // Each exact S3 deletion is followed by its own durable DB transaction. If a
  // crash occurs between them, rerunning the same externally authorised plan
  // reconciles an already-missing exact version and continues the remaining set.
  const result = await pruneCloudBackupRetention(prisma, authorisedPlan.profileId, undefined, { authorisedExactVersions });
  console.log(JSON.stringify({ result: "PORTABLE_RETENTION_PLAN_APPLIED", ...result }));
}

main().catch((error) => {
  const code = error instanceof Error && /^PORTABLE_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "PORTABLE_RETENTION_MAINTENANCE_FAILED";
  console.error(code);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
