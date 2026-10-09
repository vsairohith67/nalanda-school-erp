import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({ permission: vi.fn(), validate: vi.fn(), job: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireApiPermission: fixture.permission }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/onboarding", async original => ({ ...await original<typeof import("@/lib/onboarding")>(), validateStoredBatch: fixture.validate }));
vi.mock("@/lib/onboarding-api", async original => ({ ...await original<typeof import("@/lib/onboarding-api")>(), runObservedOnboardingJob: fixture.job }));
import { POST } from "@/app/api/onboarding/batches/[publicKey]/validate/route";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:47835");
  fixture.permission.mockResolvedValue({ user: { id: "SYNTHETIC-REVIEWER" } });
  fixture.validate.mockResolvedValue({ status: "VALIDATED" });
  fixture.job.mockImplementation((_input, work) => work());
});
afterEach(() => vi.unstubAllEnvs());
const call = (resolutions: unknown = {}) => POST(new NextRequest("http://127.0.0.1:47835/api/onboarding/batches/SYNTHETIC/validate", { method: "POST", headers: { origin: "http://127.0.0.1:47835", "content-type": "application/json" }, body: JSON.stringify({ resolutions }) }), { params: Promise.resolve({ publicKey: "SYNTHETIC" }) });

describe("validation route's separate resolution permission", () => {
  it("allows ordinary validation and retains private/no-store headers", async () => {
    const response = await call(); expect(response.status).toBe(200);
    expect(fixture.permission.mock.calls).toEqual([["VALIDATE_ONBOARDING_BATCH"]]);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("refuses a submitted decision without resolve permission before invoking the service or job", async () => {
    fixture.permission.mockImplementation(async permission => permission === "RESOLVE_ONBOARDING_CONFLICT" ? { response: new Response(null, { status: 403 }) } : { user: { id: "SYNTHETIC" } });
    expect((await call({ "SYNTHETIC-ROW": { decision: "CREATE_NEW", reason: "SYNTHETIC reviewed decision" } })).status).toBe(403);
    expect(fixture.validate).not.toHaveBeenCalled(); expect(fixture.job).not.toHaveBeenCalled();
  });
  it("passes explicitly authorized decisions to the existing service", async () => {
    const decisions = { "SYNTHETIC-ROW": { decision: "LINK_EXISTING", reason: "SYNTHETIC reviewed decision" } };
    expect((await call(decisions)).status).toBe(200);
    expect(fixture.permission.mock.calls).toEqual([["VALIDATE_ONBOARDING_BATCH"], ["RESOLVE_ONBOARDING_CONFLICT"]]);
    expect(fixture.validate.mock.calls[0].slice(1)).toEqual(["SYNTHETIC", "SYNTHETIC-REVIEWER", decisions]);
  });
  it("refuses validation without its own permission even when decisions are empty", async () => {
    fixture.permission.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await call()).status).toBe(403); expect(fixture.validate).not.toHaveBeenCalled();
  });
});
