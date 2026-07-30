import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { roleDashboardTitle, roleDisplayLabel, userInitials } from "../lib/role-presentation";

const source = (file: string) => readFileSync(file, "utf8");

describe("UX-1A shared login and shell", () => {
  it("presents human account labels without exposing role enums", () => {
    expect(roleDisplayLabel("SUPER_ADMIN")).toBe("School Owner");
    expect(roleDashboardTitle("PRINCIPAL")).toBe("Principal Dashboard");
    expect(roleDashboardTitle("TEACHER")).toBe("Teacher Dashboard");
    expect(userInitials("Nalanda School Owner")).toBe("NS");

    const menu = source("components/user-menu.tsx");
    expect(menu).toContain("roleDisplayLabel(user.role)");
    expect(menu).not.toContain("{user.role}");
    expect(menu).toContain('href="/change-password"');
  });

  it("keeps the identifier truthful and all failed login feedback anti-enumeration safe", () => {
    const form = source("components/login-form.tsx");
    const route = source("app/api/auth/login/route.ts");
    const generic = "We couldn’t sign you in with those details.";
    expect(form).toContain("Username or email");
    expect(form).toContain('autoComplete="username"');
    expect(form).toContain('autoComplete="current-password"');
    expect(form).toContain('getModifierState("CapsLock")');
    expect(form).toContain("submitInFlight.current");
    expect(form).toContain(generic);
    expect(route).toContain(generic);
    expect(route).not.toMatch(/Invalid username|username\/email and password are required|Unable to sign in/i);
    expect(route).not.toContain("user: { id:");
  });

  it("uses the exact governed login identity and real support routes without a fake reset", () => {
    const page = source("app/login/page.tsx");
    for (const text of [
      "Nalanda Public School",
      "Nalanda Education Management System",
      "Unified School Management Platform"
    ]) expect(page).toContain(text);
    for (const href of ["/privacy", "/terms", "/contact"]) expect(page).toContain(`href="${href}"`);
    expect(page).not.toMatch(/Forgot Password/i);
    expect(page).not.toContain("Academic Year");
  });

  it("keeps one compact authenticated year control and permission-driven navigation", () => {
    const shell = source("components/app-shell.tsx");
    expect(shell).toContain("groupedVisibleNavigationItems(permissions, user.role)");
    expect(shell).toContain("<AcademicYearControl academicYear={settings.academicYear} />");
    expect(shell).toContain("roleDashboardTitle(user.role)");
    expect(shell).not.toContain("Fee Control");
    expect(shell).not.toContain("Academic Year {settings.academicYear}");
    expect(shell).not.toMatch(/role picker|switch role/i);
  });

  it("preserves the current-password gate and expires the current session after change", () => {
    const control = source("lib/password-control.ts");
    const route = source("app/api/auth/change-password/route.ts");
    expect(control).toContain("verifyPassword(input.currentPassword");
    expect(control).toContain("validateNewPassword(input.newPassword)");
    expect(control).toContain("different from the current password");
    expect(route).toContain('action: "OWN_PASSWORD_CHANGED"');
    expect(route).toContain("sessionCookieName()");
    expect(route).toContain("expires: new Date(0)");
    expect(route).toContain('"cache-control", "private, no-store"');
  });

  it("defines reusable tokens, exact mobile order targets, focus, and reduced motion", () => {
    const css = source("app/globals.css");
    for (const token of [
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--space-1",
      "--font-ui",
      "--shadow-raised"
    ]) expect(css).toContain(token);
    expect(css).toMatch(/\.mobile-header-cluster[\s\S]*?\.top-actions/);
    expect(css).toContain(".academic-year-control");
    expect(css).toContain(".notification-bell");
    expect(css).toContain(".user-avatar");
    expect(css).toMatch(/button:focus-visible,[\s\S]*?outline:\s*2px solid var\(--accent\)/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("overflow-x: hidden");
  });

  it("ships a transparent derivative pipeline from the governed logo and copied-database QA only", () => {
    expect(existsSync("public/nalanda-logo.jpg")).toBe(true);
    expect(existsSync("public/nalanda-logo-transparent.png")).toBe(true);
    expect(source("middleware.ts")).toContain('"/nalanda-logo-transparent.png"');
    expect(source("tools/export-transparent-logo.ps1")).toContain("Format32bppArgb");
    const fixture = source("scripts/qa-ux1a-copied-db.ts");
    expect(fixture).toContain("assertIsolatedDatabasePath");
    expect(fixture).toContain("copyFileSync(OPERATIONAL_DATABASE");
    expect(fixture).toContain("UX1AQA_OPERATIONAL_DATABASE_CHANGED");
    expect(fixture).toContain("credentials: \"Stored only in the ignored UX1A runtime state file; not printed\"");
    expect(fixture).not.toContain("user.updateMany");
  });

  it("separates authorised health details from deployment readiness", () => {
    const dashboard = source("app/dashboard/page.tsx");
    const panel = source("components/system-health-panel.tsx");
    expect(dashboard).toContain("Core application health");
    expect(dashboard).toContain("Deployment readiness");
    expect(panel).toContain("Restricted technical details for authorised school leadership");
    expect(panel).toContain("this is not continuous monitoring");
  });
});
