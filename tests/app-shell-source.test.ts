import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app shell responsive navigation source contract", () => {
  it("uses grouped permission-derived navigation and mobile drawer controls", () => {
    const source = readFileSync("components/app-shell.tsx", "utf8");

    expect(source).toContain("groupedVisibleNavigationItems(permissions, user.role, enabledFeatures)");
    expect(source).toContain('href="/parent/class-x-documents"');
    expect(source).toContain('href="/parent/student-departures"');
    expect(source).toContain('permissions.includes("REQUEST_STUDENT_DEPARTURE")');
    expect(source).not.toContain('user.role !== "TEACHER" && (permissions.includes("MANAGE_OWN_WHATSAPP_CONSENT")');
    expect(source).toContain("mobileNavOpen");
    expect(source).toContain('aria-label="Open navigation menu"');
    expect(source).toContain('aria-label="Close navigation menu"');
    expect(source).toContain('className="app-skip-link"');
    expect(source).toContain('id="main-content"');
    expect(source).toContain("setMobileNavOpen(false)");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("mobileMenuButtonRef.current?.focus()");
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("document.activeElement === first");
    expect(source).toContain("document.activeElement === last");
  });

  it("keeps the mobile shell off-canvas instead of flowing above content", () => {
    const css = readFileSync("app/globals.css", "utf8");

    expect(css).toContain(".mobile-nav-open .sidebar");
    expect(css).toContain("transform: translateX(-105%)");
    expect(css).toContain(".nav-backdrop");
    expect(css).toContain("inset: 0 0 0 min(320px, calc(100% - 48px))");
    expect(css).not.toContain("calc(100vw - 48px)");
    expect(css).toContain(".mobile-menu-toggle");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain("visibility: visible");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain(".table-wrap table");
    expect(css).toContain(".table-wrap td a:not(.button)");
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*?\.nav a \{\s*min-height: 44px;\s*\}/);
  });
});
