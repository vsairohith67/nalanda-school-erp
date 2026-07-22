import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SEC-1 portal role boundaries", () => {
  it("redirects wrong-role Parent and Teacher notification pages", () => {
    const parent = readFileSync("app/parent/notifications/page.tsx", "utf8");
    const teacher = readFileSync("app/teacher/notifications/page.tsx", "utf8");

    expect(parent).toContain('if (user.role !== "PARENT") redirect("/unauthorized")');
    expect(teacher).toContain('if (user.role !== "TEACHER") redirect("/unauthorized")');
    expect(parent).not.toContain('if (user.role !== "PARENT") return null');
    expect(teacher).not.toContain('if (user.role !== "TEACHER") return null');
  });

  it("keeps Parent consent separate from linked-Staff consent", () => {
    const parent = readFileSync("app/parent/communication-preferences/page.tsx", "utf8");
    const staffPage = readFileSync("app/teacher/communication-preferences/page.tsx", "utf8");
    const staffApi = readFileSync("app/api/teacher/communication-preferences/route.ts", "utf8");

    expect(parent).toContain('if (user.role !== "PARENT") redirect("/unauthorized")');
    expect(staffPage).toContain('if (user.role === "PARENT") redirect("/unauthorized")');
    expect(staffApi.match(/auth\.user\.role === "PARENT"/g)).toHaveLength(2);
    expect(staffApi).toContain('status: 403');
    expect(staffApi).toContain("ownStaffOnly: true");
    expect(staffApi).toContain("ownStaffConsent: true");
  });

  it("models linked-Staff preferences as permission-scoped, not Teacher-only", () => {
    const sweep = readFileSync("scripts/sec1-runtime-route-sweep.ts", "utf8");
    expect(sweep).toContain("linkedStaffPreferenceRoute");
    expect(sweep).toContain("&& !linkedStaffPreferenceRoute");
  });

  it("reserves a scrollbar-safe 48px mobile drawer backdrop target", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const mobileDrawer = css.slice(css.indexOf("@media (max-width: 980px)"));

    expect(mobileDrawer).toContain("width: min(320px, calc(100% - 48px));");
    expect(mobileDrawer).toContain("inset: 0 0 0 min(320px, calc(100% - 48px));");
    expect(mobileDrawer).not.toContain("calc(100vw - 48px)");
  });
});
