import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";

const workspace = path.resolve(".");
const argument = process.argv.find((value) => value.startsWith("--database="));
const database = path.resolve(argument?.slice("--database=".length) || process.env.COMMUNICATION_BROWSER_DATABASE || "");
const allowedRoot = path.join(workspace, "tmp");
const relative = path.relative(allowedRoot, database);
if (!database || !existsSync(database) || !statSync(database).isFile()) throw new Error("COMMUNICATION_BROWSER_DATABASE_MISSING");
if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !relative.startsWith(`communication-delivery-1a-`)) {
  throw new Error("COMMUNICATION_BROWSER_DATABASE_NOT_ISOLATED");
}
for (const suffix of ["-wal", "-shm", "-journal"]) if (existsSync(`${database}${suffix}`)) throw new Error("COMMUNICATION_BROWSER_DATABASE_SIDECAR_PRESENT");

const client = new PrismaClient({ datasourceUrl: `file:${database.replaceAll("\\", "/")}` });
const password = `Comm1A-${randomBytes(18).toString("base64url")}!`;
const generatedAt = new Date("2026-09-04T06:00:00.000Z");
const roles = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "COMPUTER_OPERATOR", "VIEWER"] as const;
const usernames: Record<string, string> = {};

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function main() {
  const passwordHash = await hashPassword(password);
  const users: Array<{ id: string; role: string; username: string }> = [];
  for (const role of roles) {
    const id = randomUUID(), username = `comm1a-${role.toLowerCase().replaceAll("_", "-")}-${id.slice(0, 8)}`;
    await client.user.create({ data: { id, iamPublicKey: randomUUID(), name: `Synthetic Communication ${role.replaceAll("_", " ")}`, username, passwordHash, role, isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
    await client.authLoginAlias.create({ data: { userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: generatedAt } });
    await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, status: "ACTIVE", validFrom: generatedAt, reason: "COMMUNICATIONDELIVERYFOUNDATION1A synthetic browser QA", activeKey: `${id}:${role}` } });
    users.push({ id, role, username }); usernames[role] = username;
  }
  const customId = randomUUID(), customUsername = `comm1a-custom-${customId.slice(0, 8)}`;
  await client.user.create({ data: { id: customId, iamPublicKey: randomUUID(), name: "Synthetic Communication Custom Role", username: customUsername, passwordHash, role: "VIEWER", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
  await client.authLoginAlias.create({ data: { userId: customId, type: "USERNAME", normalizedValue: customUsername, displayMasked: customUsername, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: generatedAt } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: customId, role: "VIEWER", status: "ACTIVE", validFrom: generatedAt, reason: "COMMUNICATIONDELIVERYFOUNDATION1A synthetic custom-role browser QA", activeKey: `${customId}:VIEWER` } });
  users.push({ id: customId, role: "CUSTOM", username: customUsername }); usernames.CUSTOM = customUsername;

  const intentId = randomUUID();
  await client.communicationIntent.create({ data: { id: intentId, eventType: "SYNTHETIC_BROWSER_REVIEW", purpose: "TRANSACTIONAL", module: "COMMUNICATION", sourceRecordType: "SYNTHETIC_BROWSER_FIXTURE", sourceRecordId: "synthetic-browser", sourceEventId: randomUUID(), recipientPolicy: "SYNTHETIC_REVIEWED_SNAPSHOT", recipientPolicyVersion: 1, recipientScopeJson: JSON.stringify({ synthetic: true, users: users.length }), eligibleChannelsJson: JSON.stringify(["IN_APP"]), templateKey: "REPORT_AVAILABLE", templateVersion: 1, localePreference: "en-IN", priority: "TRANSACTIONAL", deduplicationKey: digest("communication-browser-intent-dedup"), idempotencyKey: digest("communication-browser-intent-idempotency"), initiatingActorId: users[0].id, authorizingContextJson: JSON.stringify({ syntheticBrowserReview: true }), audienceSnapshotHash: digest(users.map((user) => user.id).sort().join("|")), state: "RESOLVED", createdAt: generatedAt, updatedAt: generatedAt } });
  await client.communicationOutboxItem.createMany({ data: users.map((user, index) => ({ id: randomUUID(), intentId, recipientUserId: user.id, recipientSubjectType: "SYNTHETIC_USER", recipientSubjectReferenceId: user.id, channel: "IN_APP", contactVersion: 1, locale: "en-IN", templateKey: "REPORT_AVAILABLE", templateVersion: 1, substitutionsJson: JSON.stringify({ schoolDisplayName: "Nalanda Synthetic School" }), contentHash: digest(`communication-browser-content-${user.role}`), deduplicationKey: digest(`communication-browser-dedup-${user.id}`), idempotencyKey: digest(`communication-browser-idempotency-${user.id}`), state: "DELIVERED", priority: index === 0 ? "SECURITY" : "TRANSACTIONAL", scheduledAt: generatedAt, maximumAttempts: 1, deliveredAt: generatedAt, createdAt: new Date(generatedAt.getTime() + index), updatedAt: new Date(generatedAt.getTime() + index) })) });

  const runtimePath = path.join(path.dirname(database), "communication-browser-runtime.json");
  writeFileSync(runtimePath, JSON.stringify({ databaseUrl: `file:${database.replaceAll("\\", "/")}`, password, usernames, generatedAt: generatedAt.toISOString(), fixture: "SYNTHETIC_COPY_ONLY" }, null, 2), { flag: "wx", mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ result: "COMMUNICATION_BROWSER_FIXTURES_READY", roles: Object.keys(usernames), notifications: users.length, runtimePath })}\n`);
}

main().finally(() => client.$disconnect());
