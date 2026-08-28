import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createS3CompatiblePrivateObjectStore, PrivateObjectStoreError } from "@/lib/portable-runtime/private-object-store";
import { createValkeyRateLimitStore } from "@/lib/portable-runtime/valkey-rate-limit-store";
import { withPostgresJobLock } from "@/lib/portable-runtime/job-lock";
import { hydratePortableRuntimeSecrets } from "@/lib/portable-runtime/secrets";

hydratePortableRuntimeSecrets();
process.env.DATABASE_PROVIDER = "postgresql";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

const checks: Record<string, unknown> = {};
const valkeyA = createValkeyRateLimitStore();
const valkeyB = createValkeyRateLimitStore();
const objectStore = createS3CompatiblePrivateObjectStore();
const s3ControlProbe = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ""
  },
  maxAttempts: 1
});
const prisma = new PrismaClient();

try {
  const health = await Promise.all([valkeyA.healthCheck(), objectStore.healthCheck()]);
  invariant(health.every((entry) => entry.ready), "DEPENDENCY_HEALTH_FAILED");

  const rateLimitKey = `integration.shared.${randomBytes(12).toString("hex")}`;
  const rateLimitNow = Date.now();
  const attempts = await Promise.all(Array.from({ length: 100 }, (_, index) =>
    (index % 2 === 0 ? valkeyA : valkeyB).consume({
      keys: [rateLimitKey], maximum: 30, windowMs: 60_000, now: rateLimitNow
    })
  ));
  const allowed = attempts.filter((entry) => entry.allowed).length;
  invariant(allowed === 30, "DISTRIBUTED_LIMIT_NOT_ATOMIC");
  checks.distributedRateLimit = { attempts: attempts.length, allowed, blocked: attempts.length - allowed, replicas: 2 };

  const bytes = Buffer.from("portable synthetic private object qa", "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const sourceKey = "private/support/0123456789abcdef0123456789abcdef";
  const copyKey = "private/support/fedcba9876543210fedcba9876543210";
  await objectStore.putPrivateObject({ key: sourceKey, bytes, sha256: checksum, contentType: "application/octet-stream" });
  const fetched = await objectStore.getPrivateObject(sourceKey);
  invariant(fetched.bytes.equals(bytes) && fetched.metadata.sha256 === checksum, "OBJECT_ROUND_TRIP_FAILED");
  await objectStore.copyPrivateObject(sourceKey, copyKey);
  invariant(await objectStore.verifyChecksum(copyKey, checksum), "OBJECT_COPY_CHECKSUM_FAILED");
  const signed = await objectStore.authorizedDownloadUrl({ key: sourceKey, expiresSeconds: 30, contentType: "application/octet-stream", safeFilename: "synthetic.bin" });
  invariant(signed?.startsWith("http"), "OBJECT_SIGNED_URL_FAILED");
  const publicResponse = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_PRIVATE_BUCKET}/${sourceKey}`);
  invariant(publicResponse.status === 403, "OBJECT_STORE_ANONYMOUS_ACCESS_NOT_DENIED");
  let traversalRejected = false;
  try { await objectStore.getPrivateObject("private/support/../../unsafe"); }
  catch (error) { traversalRejected = error instanceof PrivateObjectStoreError && error.status === 404; }
  invariant(traversalRejected, "OBJECT_TRAVERSAL_NOT_REJECTED");
  let controlPlaneDenied = false;
  try {
    await s3ControlProbe.send(new CreateBucketCommand({ Bucket: `nalanda-unauthorized-${randomBytes(8).toString("hex")}` }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    controlPlaneDenied = status === 403 || (error as { name?: string }).name === "AccessDenied";
  }
  invariant(controlPlaneDenied, "OBJECT_STORE_APPLICATION_CREDENTIALS_OVER_PRIVILEGED");
  await objectStore.deleteGovernedObject(sourceKey);
  await objectStore.deleteGovernedObject(copyKey);
  invariant(await objectStore.statPrivateObject(sourceKey) === null, "OBJECT_DELETE_FAILED");
  checks.privateObjectStore = { roundTrip: true, checksum: true, copy: true, shortLivedUrl: true, traversalRejected, controlPlaneDenied, anonymousAccessDenied: true };

  const lockResults = await Promise.all([
    withPostgresJobLock(prisma, "integration-job-lock", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      return "held";
    }),
    new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
      withPostgresJobLock(prisma, "integration-job-lock", async () => "unexpected")
    )
  ]);
  invariant(lockResults.filter((entry) => entry.acquired).length === 1, "JOB_LOCK_DUPLICATE_EXECUTION");
  invariant(lockResults.filter((entry) => !entry.acquired).length === 1, "JOB_LOCK_CONTENTION_NOT_OBSERVED");
  checks.postgresJobLock = { acquired: 1, contended: 1 };

  checks.syntheticSeedMarker = await prisma.schoolSettings.count({ where: { id: "portable-synthetic-marker" } });
  invariant(checks.syntheticSeedMarker === 1, "SYNTHETIC_SEED_MARKER_MISSING_OR_DUPLICATE");

  console.log(JSON.stringify({ result: "PORTABLE_INTEGRATION_QA_PASSED", checks }));
} finally {
  objectStore.close();
  s3ControlProbe.destroy();
  await Promise.all([valkeyA.close(), valkeyB.close(), prisma.$disconnect()]);
}
