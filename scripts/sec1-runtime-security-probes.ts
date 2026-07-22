import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

const BASE_URL = process.env.SEC1_BASE_URL ?? "http://127.0.0.1:3011";
const MARKER = process.env.SEC1_QA_MARKER ?? "QASEC1";
if (!/^QASEC1(?:QA)?$/.test(MARKER)) {
  throw new Error("SEC-1 probe marker must be QASEC1 or QASEC1QA.");
}
const PREFIX = `${MARKER.toLowerCase()}-`;
const PASSWORD = process.env.SEC1_QA_PASSWORD ?? "Qasec1Runtime@2026";
const CHANGED_PASSWORD = `${PASSWORD}-Changed`;
const RUNTIME_ROOT = process.env.SEC1_RUNTIME_ROOT ??
  path.join(process.cwd(), "tmp", "sec1-runtime");
const OUTPUT_PATH = path.join(RUNTIME_ROOT, "security-probes.json");

type Evidence = {
  name: string;
  status: number | string;
  detail: string;
};

const evidence: Evidence[] = [];

function assertIsolation() {
  if (process.env.QA20C_ISOLATED_DATABASE !== "true") {
    throw new Error("QASEC1_COPIED_DATABASE_REQUIRED");
  }
  const base = new URL(BASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname)) {
    throw new Error("QASEC1_LOCAL_SERVER_REQUIRED");
  }
}

async function request(
  pathname: string,
  init: RequestInit = {}
) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    ...init
  });
}

async function login(identifier: string, password = PASSWORD) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      "x-forwarded-for": "127.0.0.1"
    },
    body: JSON.stringify({ identifier, password })
  });
  return {
    response,
    body: await response.text(),
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    setCookie: response.headers.get("set-cookie") ?? ""
  };
}

function requireStatus(name: string, actual: number, expected: number | number[], detail = "") {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(actual)) {
    throw new Error(`${name}: expected ${allowed.join("/")} but received ${actual}`);
  }
  evidence.push({ name, status: actual, detail });
}

function assertRedacted(name: string, body: string) {
  if (/(prisma|sqlite|users[\\/]dell|node_modules|stack trace|select\s+.+\s+from)/i.test(body)) {
    throw new Error(`${name}: response exposed implementation details`);
  }
}

async function main() {
  assertIsolation();

  const wrong = await login(`${PREFIX}viewer`, `${MARKER}-wrong-password`);
  const unknown = await login(`${PREFIX}unknown`, `${MARKER}-wrong-password`);
  const disabled = await login(`${PREFIX}disabled`, PASSWORD);
  for (const result of [wrong, unknown, disabled]) {
    requireStatus("generic login rejection", result.response.status, 401);
    assertRedacted("generic login rejection", result.body);
  }
  if (new Set([wrong.body, unknown.body, disabled.body]).size !== 1) {
    throw new Error("Login rejection bodies differ and may disclose account state.");
  }
  evidence.push({ name: "login enumeration", status: "PASS", detail: "wrong, unknown, and disabled are identical" });

  const malformed = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: "{"
  });
  requireStatus("malformed JSON", malformed.status, 400);
  assertRedacted("malformed JSON", await malformed.text());

  const unsupported = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "text/plain", origin: BASE_URL },
    body: MARKER
  });
  requireStatus("unsupported content type", unsupported.status, 415);

  const first = await login(`${PREFIX}super-admin`);
  const second = await login(`${PREFIX}super-admin`);
  requireStatus("valid login", first.response.status, 200);
  requireStatus("concurrent login", second.response.status, 200);
  if (!first.cookie || !second.cookie || first.cookie === second.cookie) {
    throw new Error("Session cookies did not rotate across successful logins.");
  }
  if (!/HttpOnly/i.test(first.setCookie) || !/SameSite=strict/i.test(first.setCookie)) {
    throw new Error("Local production QA cookie is missing HttpOnly or SameSite=Strict.");
  }
  evidence.push({
    name: "session rotation and cookie flags",
    status: "PASS",
    detail: "unique cookies; HttpOnly; SameSite=Strict; Secure intentionally off for local HTTP only"
  });

  const tamperedCookie = `${first.cookie.slice(0, -1)}${first.cookie.endsWith("a") ? "b" : "a"}`;
  const tampered = await request("/dashboard", { headers: { cookie: tamperedCookie } });
  requireStatus("tampered session", tampered.status, 307);

  const crossSiteLogout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie: first.cookie, origin: `https://attacker.${MARKER.toLowerCase()}.invalid` }
  });
  requireStatus("cross-site logout CSRF", crossSiteLogout.status, 403);
  const sameSiteLogout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie: first.cookie, origin: BASE_URL }
  });
  requireStatus("same-origin logout", sameSiteLogout.status, 200);
  if (!/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sameSiteLogout.headers.get("set-cookie") ?? "")) {
    throw new Error("Logout did not expire the session cookie.");
  }

  const publicResponse = await request("/");
  requireStatus("public home", publicResponse.status, 200);
  if (publicResponse.headers.has("set-cookie")) throw new Error("Public home created a session cookie.");
  const loginPage = await request("/login");
  const requiredHeaders = [
    "content-security-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy"
  ];
  for (const header of requiredHeaders) {
    if (!loginPage.headers.get(header)) throw new Error(`Missing runtime header: ${header}`);
  }
  if (loginPage.headers.has("x-powered-by")) throw new Error("X-Powered-By remains exposed.");
  evidence.push({ name: "headers and public cookie boundary", status: "PASS", detail: requiredHeaders.join(", ") });

  const cors = await request("/api/students", {
    method: "OPTIONS",
    headers: {
      origin: `https://attacker.${MARKER.toLowerCase()}.invalid`,
      "access-control-request-method": "GET"
    }
  });
  if (cors.headers.has("access-control-allow-origin")) throw new Error("Unexpected cross-origin allowance.");
  evidence.push({ name: "CORS default deny", status: cors.status, detail: "no Access-Control-Allow-Origin" });

  const injectionPayloads = [
    "' OR 1=1 --",
    `<script>window.${MARKER}=true</script>`,
    `=HYPERLINK("https://${MARKER.toLowerCase()}.invalid","${MARKER}")`,
    "..%2F..%2Fetc%2Fpasswd",
    `${MARKER}%0d%0aX-${MARKER}-Test%3A%20true`
  ];
  for (const payload of injectionPayloads) {
    const response = await request(`/api/students?q=${encodeURIComponent(payload)}`, {
      headers: { cookie: second.cookie, accept: "application/json" }
    });
    requireStatus("inert injection payload", response.status, 200, payload.slice(0, 24));
    assertRedacted("inert injection payload", await response.text());
  }

  for (const endpoint of [
    `/api/certificates/${PREFIX}object-missing/versions/NaN`,
    `/api/id-cards/${PREFIX}object-missing/versions/1%0d%0a`
  ]) {
    const response = await request(endpoint, {
      headers: { cookie: second.cookie, accept: "application/json" }
    });
    requireStatus("invalid numeric path", response.status, [400, 404]);
    assertRedacted("invalid numeric path", await response.text());
  }

  const parent = await login(`${PREFIX}parent`);
  requireStatus("parent login", parent.response.status, 200);
  const linkedChild = await request(`/api/parent/dashboard?studentId=${PREFIX}student-linked`, {
    headers: { cookie: parent.cookie, accept: "application/json" }
  });
  requireStatus("parent linked-child access", linkedChild.status, 200);
  const unrelatedChild = await request(`/api/parent/dashboard?studentId=${PREFIX}student-unrelated`, {
    headers: { cookie: parent.cookie, accept: "application/json" }
  });
  const missingChild = await request(`/api/parent/dashboard?studentId=${PREFIX}student-missing`, {
    headers: { cookie: parent.cookie, accept: "application/json" }
  });
  requireStatus("parent unrelated-child IDOR denial", unrelatedChild.status, 404);
  requireStatus("parent missing-child denial", missingChild.status, 404);
  if (await unrelatedChild.text() !== await missingChild.text()) {
    throw new Error("Parent IDOR denial discloses whether an unrelated Student exists.");
  }
  evidence.push({
    name: "parent object-existence isolation",
    status: "PASS",
    detail: "unrelated and nonexistent Student responses are identical"
  });

  const teacher = await login(`${PREFIX}teacher`);
  requireStatus("teacher login", teacher.response.status, 200);
  const ownTeacherPortal = await request("/api/teacher/homework", {
    headers: { cookie: teacher.cookie, accept: "application/json" }
  });
  requireStatus("teacher own-scope portal", ownTeacherPortal.status, 200);
  const peerStaff = await request(`/api/staff/${PREFIX}staff-teacher-peer`, {
    method: "PUT",
    headers: {
      cookie: teacher.cookie,
      accept: "application/json",
      "content-type": "application/json",
      origin: BASE_URL
    },
    body: "{}"
  });
  requireStatus("teacher peer Staff IDOR denial", peerStaff.status, [403, 404]);

  const oversized = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ identifier: `${PREFIX}oversized`, password: "Q".repeat(5 * 1024 * 1024) })
  });
  requireStatus("oversized request", oversized.status, 413);
  assertRedacted("oversized request", await oversized.text());

  const viewer = await login(`${PREFIX}viewer`);
  requireStatus("viewer login", viewer.response.status, 200);
  const viewerAllowed = await request("/students/lifecycle", { headers: { cookie: viewer.cookie } });
  requireStatus("viewer baseline permission", viewerAllowed.status, 200);
  await prisma.user.update({ where: { id: `${PREFIX}user-viewer` }, data: { role: "ACCOUNTANT" } });
  try {
    const afterRoleChange = await request("/students/lifecycle", { headers: { cookie: viewer.cookie } });
    const afterRoleChangeBody = await afterRoleChange.text();
    if (afterRoleChange.status === 307) {
      requireStatus("stale role session", afterRoleChange.status, 307);
    } else if (
      afterRoleChange.status === 200 &&
      afterRoleChangeBody.includes("NEXT_REDIRECT") &&
      afterRoleChangeBody.includes("/login") &&
      !afterRoleChangeBody.includes(`${MARKER} Linked Child`)
    ) {
      evidence.push({
        name: "stale role streamed session invalidation",
        status: 200,
        detail: "Next.js streamed redirect to /login; no QA child content"
      });
    } else {
      throw new Error(`stale role session: unexpected ${afterRoleChange.status} response`);
    }
  } finally {
    await prisma.user.update({ where: { id: `${PREFIX}user-viewer` }, data: { role: "VIEWER" } });
  }

  let changedCookie = "";
  const originalViewer = await prisma.user.findUniqueOrThrow({
    where: { id: `${PREFIX}user-viewer` },
    select: { passwordHash: true }
  });
  try {
    const change = await request("/api/auth/change-password", {
      method: "POST",
      headers: { cookie: viewer.cookie, origin: BASE_URL, "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: PASSWORD,
        newPassword: CHANGED_PASSWORD,
        confirmPassword: CHANGED_PASSWORD
      })
    });
    requireStatus("password change", change.status, 200);
    const changedViewer = await prisma.user.findUniqueOrThrow({
      where: { id: `${PREFIX}user-viewer` },
      select: { passwordHash: true }
    });
    if (changedViewer.passwordHash === originalViewer.passwordHash) {
      throw new Error("Password change returned success without changing the credential hash.");
    }
    const staleAfterPasswordChange = await request("/dashboard", { headers: { cookie: viewer.cookie } });
    const stalePageBody = await staleAfterPasswordChange.text();
    const staleApiAfterPasswordChange = await request("/api/dashboard", {
      headers: { cookie: viewer.cookie, accept: "application/json" }
    });
    console.log(JSON.stringify({
      passwordChangeDiagnostic: {
        pageStatus: staleAfterPasswordChange.status,
        apiStatus: staleApiAfterPasswordChange.status
      }
    }));
    if (staleAfterPasswordChange.status === 307) {
      requireStatus("password-change page session invalidation", staleAfterPasswordChange.status, 307);
    } else if (
      staleAfterPasswordChange.status === 200 &&
      stalePageBody.includes("NEXT_REDIRECT") &&
      stalePageBody.includes("/login") &&
      !stalePageBody.includes(`${MARKER} Linked Child`)
    ) {
      evidence.push({
        name: "password-change streamed page invalidation",
        status: 200,
        detail: "Next.js streamed redirect to /login; no QA child content"
      });
    } else {
      throw new Error(
        `password-change page session invalidation: unexpected ${staleAfterPasswordChange.status} response`
      );
    }
    requireStatus("password-change API session invalidation", staleApiAfterPasswordChange.status, 401);
    const changed = await login(`${PREFIX}viewer`, CHANGED_PASSWORD);
    requireStatus("changed-password login", changed.response.status, 200);
    changedCookie = changed.cookie;
  } finally {
    await prisma.user.update({
      where: { id: `${PREFIX}user-viewer` },
      data: { passwordHash: await hashPassword(PASSWORD), role: "VIEWER", isActive: true }
    });
  }
  const staleChangedCookie = await request("/dashboard", { headers: { cookie: changedCookie } });
  const staleChangedBody = await staleChangedCookie.text();
  if (staleChangedCookie.status === 307) {
    requireStatus("restored-password session invalidation", staleChangedCookie.status, 307);
  } else if (
    staleChangedCookie.status === 200 &&
    staleChangedBody.includes("NEXT_REDIRECT") &&
    staleChangedBody.includes("/login") &&
    !staleChangedBody.includes(`${MARKER} Linked Child`)
  ) {
    evidence.push({
      name: "restored-password streamed session invalidation",
      status: 200,
      detail: "Next.js streamed redirect to /login; no QA child content"
    });
  } else {
    throw new Error(`restored-password session invalidation: unexpected ${staleChangedCookie.status} response`);
  }

  const rateStatuses: number[] = [];
  for (let index = 0; index < 11; index += 1) {
    rateStatuses.push((await login(`${PREFIX}rate-limit-missing`, `${MARKER}-wrong-password`)).response.status);
  }
  const first429 = rateStatuses.indexOf(429);
  if (
    first429 < 1 ||
    rateStatuses.slice(0, first429).some((status) => status !== 401) ||
    rateStatuses.slice(first429).some((status) => status !== 429)
  ) {
    throw new Error(`Unexpected bounded login rate-limit statuses: ${rateStatuses.join(",")}`);
  }
  evidence.push({
    name: "bounded login rate limit",
    status: "PASS",
    detail: rateStatuses.join(",")
  });

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ passed: evidence.length, evidence }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: evidence.length, evidence }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "SEC-1B runtime security probes failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
