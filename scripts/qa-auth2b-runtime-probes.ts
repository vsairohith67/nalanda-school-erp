import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const RUNTIME = path.resolve("tmp", "auth2b-browser", ".runtime.json");
const runtime = JSON.parse(readFileSync(RUNTIME, "utf8")) as {
  username: string;
  password: string;
  disabledUsername: string;
  pendingAlias: string;
  expiredResetToken: string;
  usedResetToken: string;
  databaseUrl: string;
  origin: string;
};
const origin = runtime.origin;
const resetCredential = ["AUTH2BQA", "Runtime", "New", "Password!"].join("-");

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }

async function post(pathname: string, body: unknown, source: string, requestOrigin = origin) {
  return fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin, "x-forwarded-for": source },
    body: JSON.stringify(body),
    redirect: "manual"
  });
}

async function login(identifier: string, password: string, source: string) {
  const response = await post("/api/auth/login", { identifier, password }, source);
  const json = await response.json() as { error?: string };
  return { response, json };
}

async function main() {
  const publicFailures = [
    await login(`missing-${Date.now()}`, "wrong-password", "203.0.113.11"),
    await login(runtime.username, "wrong-password", "203.0.113.12"),
    await login(runtime.disabledUsername, runtime.password, "203.0.113.13"),
    await login(runtime.pendingAlias, runtime.password, "203.0.113.14")
  ];
  const genericError = publicFailures[0].json.error;
  for (const failure of publicFailures) {
    invariant(failure.response.status === 401, "AUTH2BQA_PUBLIC_LOGIN_STATUS_DIVERGED");
    invariant(failure.json.error === genericError && Boolean(genericError), "AUTH2BQA_PUBLIC_LOGIN_MESSAGE_DIVERGED");
    invariant(failure.response.headers.get("cache-control")?.includes("no-store"), "AUTH2BQA_PUBLIC_LOGIN_CACHEABLE");
  }

  let throttled: Response | null = null;
  const throttledIdentifier = `throttle-${Date.now()}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    throttled = (await login(throttledIdentifier, "wrong-password", "203.0.113.15")).response;
  }
  invariant(throttled?.status === 429 && Number(throttled.headers.get("retry-after")) > 0, "AUTH2BQA_LOGIN_THROTTLE_MISSING");

  const recoveryCases = [
    await post("/api/auth/recovery/request", { identifier: `missing-${Date.now()}`, channelType: "WORK_EMAIL" }, "203.0.113.21"),
    await post("/api/auth/recovery/request", { identifier: runtime.disabledUsername, channelType: "WORK_EMAIL" }, "203.0.113.22"),
    await post("/api/auth/recovery/request", { identifier: runtime.pendingAlias, channelType: "PERSONAL_EMAIL" }, "203.0.113.23"),
    await post("/api/auth/recovery/request", { identifier: runtime.username, channelType: "PERSONAL_EMAIL" }, "203.0.113.24")
  ];
  const recoveryBodies = await Promise.all(recoveryCases.map((response) => response.json() as Promise<{ message?: string }>));
  invariant(recoveryBodies.every((body) => body.message === recoveryBodies[0].message && Boolean(body.message)), "AUTH2BQA_RECOVERY_ENUMERATION_RESPONSE");
  invariant(recoveryCases.every((response) => response.status === 202 && response.headers.get("cache-control")?.includes("no-store")), "AUTH2BQA_RECOVERY_PRIVACY_HEADERS");

  const expired = await post("/api/auth/recovery/reset", { token: runtime.expiredResetToken, newPassword: resetCredential, confirmPassword: resetCredential }, "203.0.113.31");
  const used = await post("/api/auth/recovery/reset", { token: runtime.usedResetToken, newPassword: resetCredential, confirmPassword: resetCredential }, "203.0.113.32");
  const [expiredBody, usedBody] = await Promise.all([expired.json(), used.json()]) as [{ error?: string }, { error?: string }];
  invariant(expired.status === 400 && used.status === 400 && expiredBody.error === usedBody.error, "AUTH2BQA_RESET_ENUMERATION_RESPONSE");
  invariant(expired.headers.get("cache-control")?.includes("no-store") && used.headers.get("cache-control")?.includes("no-store"), "AUTH2BQA_RESET_CACHEABLE");

  const crossOrigin = await post("/api/auth/login", { identifier: runtime.username, password: runtime.password }, "203.0.113.33", "https://evil.example");
  invariant(crossOrigin.status === 403, "AUTH2BQA_CROSS_ORIGIN_AUTH_ALLOWED");
  const oversized = await post("/api/auth/login", { identifier: runtime.username, password: "x".repeat(17_000) }, "203.0.113.34");
  invariant(oversized.status === 413, "AUTH2BQA_AUTH_BODY_LIMIT_MISSING");

  const first = await login(runtime.username, runtime.password, "203.0.113.41");
  const second = await login(runtime.username, runtime.password, "203.0.113.42");
  invariant(first.response.status === 200 && second.response.status === 200, "AUTH2BQA_VALID_LOGIN_FAILED");
  const firstCookie = first.response.headers.get("set-cookie") ?? "";
  const secondCookie = second.response.headers.get("set-cookie") ?? "";
  invariant(firstCookie !== secondCookie, "AUTH2BQA_LOGIN_SESSION_NOT_ROTATED");
  invariant(/HttpOnly/i.test(firstCookie) && /SameSite=strict/i.test(firstCookie) && /Path=\//i.test(firstCookie), "AUTH2BQA_COOKIE_CONTRACT_INVALID");
  const cookie = secondCookie.split(";", 1)[0];
  const security = await fetch(`${origin}/api/auth/security`, { headers: { cookie }, cache: "no-store" });
  const securityText = await security.text();
  invariant(security.status === 200 && !/"(?:id|aliasId|sessionId)"\s*:/.test(securityText), "AUTH2BQA_INTERNAL_ID_EXPOSED");
  const securityJson = JSON.parse(securityText) as { aliases: Array<{ handle: string }>; sessions: Array<{ handle: string; current: boolean }> };
  invariant(securityJson.aliases.every((row) => /^auth_[a-f0-9]{64}$/.test(row.handle)), "AUTH2BQA_ALIAS_HANDLE_INVALID");
  invariant(securityJson.sessions.every((row) => /^auth_[a-f0-9]{64}$/.test(row.handle)) && securityJson.sessions.filter((row) => row.current).length === 1, "AUTH2BQA_SESSION_HANDLE_OR_CURRENT_MARKER_INVALID");

  const client = new PrismaClient({ datasourceUrl: runtime.databaseUrl });
  try {
    const user = await client.user.findUniqueOrThrow({ where: { username: runtime.username } });
    const rawIds = [
      ...(await client.authLoginAlias.findMany({ where: { userId: user.id }, select: { id: true } })).map((row) => row.id),
      ...(await client.authSession.findMany({ where: { userId: user.id }, select: { id: true } })).map((row) => row.id)
    ];
    invariant(rawIds.every((id) => !securityText.includes(id)), "AUTH2BQA_RAW_DATABASE_ID_EXPOSED");
    invariant(await client.authSession.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }) >= 2, "AUTH2BQA_REGISTRY_ROW_PER_LOGIN_MISSING");
  } finally { await client.$disconnect(); }

  const logout = await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { cookie, origin } });
  invariant(logout.status === 200 && logout.headers.get("set-cookie")?.includes("Expires=Thu, 01 Jan 1970"), "AUTH2BQA_LOGOUT_COOKIE_NOT_CLEARED");
  const afterLogout = await fetch(`${origin}/api/auth/security`, { headers: { cookie }, redirect: "manual" });
  invariant(afterLogout.status === 401, "AUTH2BQA_LOGOUT_SESSION_REUSED");

  console.log(JSON.stringify({
    result: "AUTH2BQA_RUNTIME_PROBES_PASSED",
    genericLoginCases: publicFailures.length,
    genericRecoveryCases: recoveryCases.length,
    resetPrivacyCases: 2,
    throttled: true,
    originBlocked: true,
    bodyBounded: true,
    sessionRotated: true,
    internalIdsExposed: false
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : "AUTH2BQA_RUNTIME_PROBES_FAILED");
  process.exitCode = 1;
});
