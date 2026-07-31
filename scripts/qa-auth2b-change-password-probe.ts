import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const RUNTIME = path.resolve("tmp", "auth2b-browser", ".runtime.json");
const runtime = JSON.parse(readFileSync(RUNTIME, "utf8")) as {
  username: string;
  password: string;
  databaseUrl: string;
  origin: string;
};
const nextCredential = ["AUTH2BQA", "Change", "Password", "2026!Z"].join("-");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function login(password: string, source: string) {
  const response = await fetch(`${runtime.origin}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: runtime.origin,
      "x-forwarded-for": source
    },
    body: JSON.stringify({ identifier: runtime.username, password }),
    redirect: "manual"
  });
  return {
    response,
    cookie: (response.headers.get("set-cookie") ?? "").split(";", 1)[0]
  };
}

async function security(cookie: string) {
  return fetch(`${runtime.origin}/api/auth/security`, {
    headers: { cookie },
    cache: "no-store",
    redirect: "manual"
  });
}

async function logout(cookie: string) {
  return fetch(`${runtime.origin}/api/auth/logout`, {
    method: "POST",
    headers: { cookie, origin: runtime.origin }
  });
}

async function main() {
  const client = new PrismaClient({ datasourceUrl: runtime.databaseUrl });
  try {
    const accountBefore = await client.user.findUniqueOrThrow({
      where: { username: runtime.username },
      select: { id: true, credentialVersion: true }
    });
    const first = await login(runtime.password, "203.0.113.61");
    const second = await login(runtime.password, "203.0.113.62");
    invariant(first.response.status === 200 && second.response.status === 200, "AUTH2BQA_CHANGE_PASSWORD_SETUP_LOGIN_FAILED");
    invariant(Boolean(first.cookie) && Boolean(second.cookie) && first.cookie !== second.cookie, "AUTH2BQA_CHANGE_PASSWORD_SETUP_SESSION_FAILED");

    const staleSessionIds = (await client.authSession.findMany({
      where: { userId: accountBefore.id, revokedAt: null },
      select: { id: true }
    })).map((row) => row.id);
    invariant(staleSessionIds.length >= 2, "AUTH2BQA_CHANGE_PASSWORD_STALE_SESSION_SETUP_FAILED");

    const changed = await fetch(`${runtime.origin}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: second.cookie,
        origin: runtime.origin,
        "x-forwarded-for": "203.0.113.62"
      },
      body: JSON.stringify({
        currentPassword: runtime.password,
        newPassword: nextCredential,
        confirmPassword: nextCredential
      }),
      redirect: "manual"
    });
    const rotatedCookie = (changed.headers.get("set-cookie") ?? "").split(";", 1)[0];
    invariant(changed.status === 200 && Boolean(rotatedCookie) && rotatedCookie !== second.cookie, "AUTH2BQA_CHANGE_PASSWORD_ROTATION_FAILED");
    invariant(changed.headers.get("cache-control")?.includes("no-store"), "AUTH2BQA_CHANGE_PASSWORD_CACHEABLE");

    const accountAfter = await client.user.findUniqueOrThrow({
      where: { id: accountBefore.id },
      select: { credentialVersion: true }
    });
    invariant(accountAfter.credentialVersion === accountBefore.credentialVersion + 1, "AUTH2BQA_CHANGE_PASSWORD_VERSION_NOT_INCREMENTED");
    const staleSessions = await client.authSession.findMany({
      where: { id: { in: staleSessionIds } },
      select: { revokedAt: true, revocationReason: true }
    });
    invariant(staleSessions.length === staleSessionIds.length && staleSessions.every((row) => row.revokedAt && row.revocationReason === "PASSWORD_CHANGED"), "AUTH2BQA_CHANGE_PASSWORD_STALE_SESSIONS_NOT_REVOKED");
    invariant(await client.authSession.count({
      where: { userId: accountBefore.id, revokedAt: null, expiresAt: { gt: new Date() } }
    }) === 1, "AUTH2BQA_CHANGE_PASSWORD_ACTIVE_SESSION_COUNT_INVALID");

    invariant((await security(first.cookie)).status === 401, "AUTH2BQA_CHANGE_PASSWORD_FIRST_SESSION_REUSED");
    invariant((await security(second.cookie)).status === 401, "AUTH2BQA_CHANGE_PASSWORD_ORIGINAL_CURRENT_SESSION_REUSED");
    invariant((await security(rotatedCookie)).status === 200, "AUTH2BQA_CHANGE_PASSWORD_ROTATED_SESSION_DENIED");

    const oldLogin = await login(runtime.password, "203.0.113.63");
    invariant(oldLogin.response.status === 401, "AUTH2BQA_CHANGE_PASSWORD_OLD_PASSWORD_ACCEPTED");
    const freshLogin = await login(nextCredential, "203.0.113.64");
    invariant(freshLogin.response.status === 200 && Boolean(freshLogin.cookie), "AUTH2BQA_CHANGE_PASSWORD_NEW_PASSWORD_DENIED");

    invariant((await logout(rotatedCookie)).status === 200, "AUTH2BQA_CHANGE_PASSWORD_ROTATED_LOGOUT_FAILED");
    invariant((await logout(freshLogin.cookie)).status === 200, "AUTH2BQA_CHANGE_PASSWORD_FRESH_LOGOUT_FAILED");

    console.log(JSON.stringify({
      result: "AUTH2BQA_CHANGE_PASSWORD_PROBE_PASSED",
      credentialVersionIncremented: true,
      staleSessionsRevoked: staleSessionIds.length,
      sessionRotated: true,
      oldPasswordDenied: true,
      newPasswordAccepted: true
    }));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : "AUTH2BQA_CHANGE_PASSWORD_PROBE_FAILED");
  process.exitCode = 1;
});
