import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visibleNavigationItems } from "../lib/access-rules";
import { ROLES } from "../lib/permissions";
import {
  CANONICAL_CANVS_BOARD_ID,
  CANONICAL_CANVS_BOARD_URL,
  isSuperAdminWhiteboardRole,
  resolveSuperAdminWhiteboardDestination
} from "../lib/super-admin-whiteboard";

const DENIED_CONTEXTS = [
  ...ROLES.filter((role) => role !== "SUPER_ADMIN"),
  "MARKS_ENTRY_OPERATOR",
  "DELEGATED_CUSTOM_ROLE"
];

describe("Super Admin canonical Canvs Whiteboard bridge", () => {
  it("allows only the exact SUPER_ADMIN role", () => {
    expect(isSuperAdminWhiteboardRole("SUPER_ADMIN")).toBe(true);
    for (const role of DENIED_CONTEXTS) expect(isSuperAdminWhiteboardRole(role)).toBe(false);
  });

  it("keeps the route authorization server-side and private", () => {
    const page = readFileSync("app/super-admin/whiteboard/page.tsx", "utf8");
    expect(page).toContain('requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(page).toContain('unstable_noStore as noStore');
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).not.toMatch(/searchParams|useSearchParams|redirect\s*[:=]|window\.open/);
  });

  it("shows navigation only to the exact Super Admin role", () => {
    const permissions = ["VIEW_DASHBOARD"] as const;
    expect(visibleNavigationItems(permissions, "SUPER_ADMIN").map((item) => item.href)).toContain("/super-admin/whiteboard");
    for (const role of ROLES.filter((value) => value !== "SUPER_ADMIN")) {
      expect(visibleNavigationItems(permissions, role).map((item) => item.href)).not.toContain("/super-admin/whiteboard");
    }
  });

  it("accepts only the exact canonical board URL and fails closed otherwise", () => {
    expect(resolveSuperAdminWhiteboardDestination(undefined)).toEqual({ status: "AVAILABLE", url: CANONICAL_CANVS_BOARD_URL });
    expect(resolveSuperAdminWhiteboardDestination(CANONICAL_CANVS_BOARD_URL)).toEqual({ status: "AVAILABLE", url: CANONICAL_CANVS_BOARD_URL });

    const attempts = [
      "",
      `${CANONICAL_CANVS_BOARD_URL}&url=https://evil.example`,
      `${CANONICAL_CANVS_BOARD_URL}&board=other`,
      `${CANONICAL_CANVS_BOARD_URL}&redirect=https://evil.example`,
      `${CANONICAL_CANVS_BOARD_URL}&target=https://evil.example`,
      `${CANONICAL_CANVS_BOARD_URL}#https://evil.example`,
      `${CANONICAL_CANVS_BOARD_URL}/https%3A%2F%2Fevil.example`,
      encodeURIComponent(CANONICAL_CANVS_BOARD_URL),
      encodeURIComponent(encodeURIComponent(CANONICAL_CANVS_BOARD_URL)),
      `https://app.canvs.io/gdrive?id=${encodeURIComponent(`${CANONICAL_CANVS_BOARD_ID}&url=https://evil.example`)}`,
      `https://app.canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}&id=other`,
      `https://app.canvs.io/gdrive/?id=${CANONICAL_CANVS_BOARD_ID}`,
      `https://app.canvs.io:443/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      `//app.canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      `http://app.canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      `https://canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      `https://evil.app.canvs.io/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      `https://app.canvs.io.evil.example/gdrive?id=${CANONICAL_CANVS_BOARD_ID}`,
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "file:///tmp/unsafe",
      "https://example.com/other-board"
    ];

    for (const attempt of attempts) {
      expect(resolveSuperAdminWhiteboardDestination(attempt), attempt).toEqual({ status: "UNAVAILABLE", url: null });
    }
  });

  it("renders one protected external link and no iframe, token exchange, fetch, or user destination input", () => {
    const page = readFileSync("app/super-admin/whiteboard/page.tsx", "utf8");
    const bridge = readFileSync("lib/super-admin-whiteboard.ts", "utf8");
    const source = `${page}\n${bridge}`;
    expect(page).toContain('target="_blank"');
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('referrerPolicy="no-referrer"');
    expect(page).toContain("Open Canvs Whiteboard");
    expect(page).toContain("Opens in a new tab");
    expect(source).not.toMatch(/<iframe|postMessage|oauth|api[_-]?token|webhook|\bfetch\s*\(|prisma|excalidraw/i);
    expect(source).not.toMatch(/studentId|userId|authToken|sessionToken/);
  });
});
