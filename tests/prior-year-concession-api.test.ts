import { afterEach, describe, expect, it, vi } from "vitest";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/prior-year-concessions/route";
import { GET as income } from "@/app/api/prior-year-concessions/[id]/income/route";
import { POST as exportCases } from "@/app/api/prior-year-concessions/export/route";

const guards = vi.hoisted(() => ({ auth: vi.fn(), privateRead: vi.fn(() => { throw new Error("PRIVATE_READ_MUST_NOT_BE_REACHED"); }) }));
vi.mock("@/lib/auth", () => ({ getCurrentAuthContext: guards.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: async () => null }, userPermissionProfileAssignment: { findFirst: async () => null }, priorYearConcessionCase: { findUniqueOrThrow: guards.privateRead, findMany: guards.privateRead }, priorYearIncomeSupport: { findUnique: guards.privateRead } } }));
vi.mock("@/lib/iam/effective-access", () => ({ evaluateEffectivePermission: async () => ({ allowed: false, role: "TEACHER", profileNames: [], roleLabel: "Teacher" }) }));
const request = (path = "", body?: unknown) => new NextRequest(`http://127.0.0.1:3000/api/prior-year-concessions${path}`, body ? { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {});
function enabled(value: boolean) { vi.stubEnv("DATABASE_URL", pathToFileURL(path.resolve("tmp/prior-year-api-synthetic.db")).href); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE", "SYNTHETIC_COPY_ONLY"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", value ? "prior-year-concessions-1a" : ""); }
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("direct previous-year API trust boundaries", () => {
  it("returns feature OFF before authentication or private data access", async () => {
    enabled(false);
    for (const response of [await GET(request()), await POST(request("", { action: "APPLY" })), await income(request("/invented/income"), { params: Promise.resolve({ id: "invented" }) }), await exportCases(request("/export", { caseIds: ["invented"] }))]) expect(response.status).toBe(404);
    expect(guards.auth).not.toHaveBeenCalled(); expect(guards.privateRead).not.toHaveBeenCalled();
  });
  it("denies direct foreign-case, income and export URLs without reading protected records", async () => {
    enabled(true); guards.auth.mockResolvedValue({ user: { id: "invented-teacher", roleAssignmentId: "invented-role" }, sessionId: "invented-session" });
    expect((await GET(request("?id=invented-foreign"))).status).toBe(403);
    expect((await POST(request("", { action: "APPLY", caseId: "invented-foreign", requestKey: "invented-request" }))).status).toBe(403);
    expect((await income(request("/invented-foreign/income?exact=true"), { params: Promise.resolve({ id: "invented-foreign" }) })).status).toBe(403);
    expect((await exportCases(request("/export", { caseIds: ["invented-foreign"], includeIncome: true, exactIncome: true }))).status).toBe(403);
    expect(guards.privateRead).not.toHaveBeenCalled();
  });
});
