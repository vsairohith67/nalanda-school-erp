import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { grantMarksDelegation } from "../lib/academic-integrity";
import { hashPassword, verifyPassword } from "../lib/password";
import { assertIsolatedDatabasePath, databaseUrl, QA_ROOT } from "./migration-check-utils";

const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM2-browser-state.json");
const REASON = "ACADEMIC-INTEGRITY-1A copied Browser QA fixture";

type State = {
  databasePath: string;
  principalUsername: string;
  teacherOneUsername: string;
  principalPassword: string;
  teacherOnePassword: string;
  academicIntegrity?: {
    superAdminUsername: string;
    superAdminPassword: string;
    operatorUsername: string;
    operatorPassword: string;
  };
};

async function createRoleUser(client: PrismaClient, input: { username: string; name: string; role: "SUPER_ADMIN" | "COMPUTER_OPERATOR"; password: string; assignedByUserId: string }) {
  const user = await client.user.create({
    data: {
      iamPublicKey: randomUUID(),
      name: input.name,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      isActive: true,
      lifecycleStatus: "ACTIVE"
    }
  });
  await client.userRoleAssignment.create({
    data: {
      publicKey: randomUUID(),
      userId: user.id,
      role: input.role,
      reason: REASON,
      assignedByUserId: input.assignedByUserId,
      activeKey: `${user.id}:${input.role}`
    }
  });
  await ensureLoginAlias(client, user);
  return user;
}

async function ensureLoginAlias(client: PrismaClient, user: { id: string; username: string }) {
  const normalizedValue = user.username.trim().toLowerCase();
  const existing = await client.authLoginAlias.findUnique({ where: { normalizedValue } });
  if (existing && existing.userId !== user.id) throw new Error("ACADEMIC_INTEGRITY_BROWSER_ALIAS_COLLISION");
  if (!existing) await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue, displayMasked: user.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
}

async function ensureRoleContext(client: PrismaClient, user: { id: string; role: string; iamPublicKey: string | null }, assignedByUserId: string) {
  if (!user.iamPublicKey) await client.user.update({ where: { id: user.id }, data: { iamPublicKey: randomUUID() } });
  const existing = await client.userRoleAssignment.findFirst({ where: { userId: user.id, role: user.role as "PRINCIPAL" | "TEACHER", status: "ACTIVE" } });
  if (!existing) await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: user.role as "PRINCIPAL" | "TEACHER", reason: REASON, assignedByUserId, activeKey: `${user.id}:${user.role}` } });
}

async function main() {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const principal = await client.user.findUniqueOrThrow({ where: { username: state.principalUsername } });
    const teacher = await client.user.findUniqueOrThrow({ where: { username: state.teacherOneUsername } });
    await ensureRoleContext(client, principal, principal.id);
    await ensureRoleContext(client, teacher, principal.id);
    await ensureLoginAlias(client, principal);
    await ensureLoginAlias(client, teacher);
    if (state.academicIntegrity) {
      const [superAdmin, operator] = await Promise.all([
        client.user.findUniqueOrThrow({ where: { username: state.academicIntegrity.superAdminUsername } }),
        client.user.findUniqueOrThrow({ where: { username: state.academicIntegrity.operatorUsername } })
      ]);
      await ensureLoginAlias(client, superAdmin);
      await ensureLoginAlias(client, operator);
      const passwordChecks = await Promise.all([
        verifyPassword(state.principalPassword, principal.passwordHash),
        verifyPassword(state.teacherOnePassword, teacher.passwordHash),
        verifyPassword(state.academicIntegrity.superAdminPassword, superAdmin.passwordHash),
        verifyPassword(state.academicIntegrity.operatorPassword, operator.passwordHash)
      ]);
      if (!passwordChecks.every(Boolean)) throw new Error("ACADEMIC_INTEGRITY_BROWSER_PASSWORD_CHECK_FAILED");
      console.log(JSON.stringify({ result: "ACADEMIC_INTEGRITY_BROWSER_FIXTURES_READY", copiedDatabase: true, delegatedScopes: 1, operationalDataChanged: false }));
      return;
    }
    const target = await client.teacherExamAssignment.findFirstOrThrow({
      where: { status: "ACTIVE", examination: { status: "ACTIVE" }, classScope: { status: "ACTIVE" }, subjectPaper: { status: "ACTIVE" }, schemeVersion: { status: "ACTIVE", frozenAt: { not: null } } },
      orderBy: [{ assignmentRole: "desc" }, { createdAt: "asc" }]
    });
    const sharedPassword = `AI1A-${randomBytes(24).toString("base64url")}!aA9`;
    const superAdmin = await createRoleUser(client, { username: "ai1a-browser-super", name: "AI1A Browser Super Admin", role: "SUPER_ADMIN", password: sharedPassword, assignedByUserId: principal.id });
    const operator = await createRoleUser(client, { username: "ai1a-browser-operator", name: "AI1A Browser Delegated Operator", role: "COMPUTER_OPERATOR", password: sharedPassword, assignedByUserId: principal.id });
    await grantMarksDelegation(client, { id: principal.id, name: principal.name, role: "PRINCIPAL" }, {
      userHandle: operator.iamPublicKey,
      kind: "GOVERNED_COMPONENT",
      targetId: target.id,
      reason: "Approved exact-scope Browser QA data entry"
    });
    state.academicIntegrity = {
      superAdminUsername: superAdmin.username,
      superAdminPassword: sharedPassword,
      operatorUsername: operator.username,
      operatorPassword: sharedPassword
    };
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(JSON.stringify({ result: "ACADEMIC_INTEGRITY_BROWSER_FIXTURES_READY", copiedDatabase: true, delegatedScopes: 1, operationalDataChanged: false }));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
