import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveIdentityCardStatus } from "@/lib/identity-cards";
import { formulaSafeCsvCell, identityCardCsv } from "@/lib/id-card-reports";
import { can, PERMISSION_GROUPS, PERMISSIONS } from "@/lib/permissions";

const source = (path: string) => readFileSync(path, "utf8");

describe("Prompt 18C effective state and safe reports", () => {
  it("derives active/expired without mutating stored status", () => {
    const active = { status: "ISSUED", validUntil: new Date("2026-07-18T00:00:00Z") };
    expect(effectiveIdentityCardStatus(active, new Date("2026-07-17T00:00:00Z"))).toBe("ACTIVE");
    expect(active.status).toBe("ISSUED");
    expect(effectiveIdentityCardStatus({ status: "ISSUED", validUntil: new Date("2026-07-16T00:00:00Z") }, new Date("2026-07-17T00:00:00Z"))).toBe("EXPIRED");
    for (const status of ["REVOKED", "CANCELLED", "SUPERSEDED"]) expect(effectiveIdentityCardStatus({ status, validUntil: new Date("2099-01-01") })).toBe(status);
  });
  it("protects CSV formulas and uses an explicit safe allowlist", () => {
    expect(formulaSafeCsvCell("=1+1")).toBe("'=1+1");
    const csv = identityCardCsv([{ cardNumber: "QA18C-1", cardType: "STUDENT", academicYear: "2026-27", status: "ISSUED", validUntil: new Date("2027-05-31"), currentVersionNumber: 1, student: { studentName: "=Unsafe", admissionNo: "QA18C-S" }, staffMember: null }]);
    expect(csv).toContain("'=Unsafe");
    for (const forbidden of ["address", "phone", "aadhaar", "salary", "bank", "actor", "photoPath"]) expect(csv.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });
});

describe("Prompt 18C role defaults and direct guards", () => {
  it("registers all fifteen permissions in the role matrix", () => {
    const expected = ["VIEW_ID_CARDS","MANAGE_ID_CARD_TEMPLATES","MANAGE_ID_CARD_NUMBER_SERIES","CREATE_ID_CARDS","MANAGE_ID_CARD_BATCHES","APPROVE_ID_CARDS","ISSUE_ID_CARDS","CORRECT_ISSUED_ID_CARDS","REPLACE_ID_CARDS","REVOKE_ID_CARDS","USE_ID_CARD_LOOKUP","VIEW_ID_CARD_REPORTS","EXPORT_ID_CARD_REPORTS","VIEW_OWN_STUDENT_ID_CARDS","VIEW_OWN_STAFF_ID_CARD"];
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((row) => row.permission));
    for (const permission of expected) { expect(PERMISSIONS).toContain(permission); expect(grouped).toContain(permission); }
  });
  it("uses the required leadership, Admin, Viewer, Accountant, Teacher, and Parent defaults", () => {
    for (const permission of ["ISSUE_ID_CARDS","REPLACE_ID_CARDS","REVOKE_ID_CARDS","USE_ID_CARD_LOOKUP"] as const) { expect(can("DIRECTOR", permission)).toBe(true); expect(can("PRINCIPAL", permission)).toBe(true); }
    expect(can("PRINCIPAL", "MANAGE_ID_CARD_TEMPLATES")).toBe(false);
    expect(can("ADMIN", "MANAGE_ID_CARD_TEMPLATES")).toBe(true);
    expect(can("ADMIN", "ISSUE_ID_CARDS")).toBe(false);
    expect(can("VIEWER", "VIEW_ID_CARD_REPORTS")).toBe(true);
    expect(can("VIEWER", "EXPORT_ID_CARD_REPORTS")).toBe(false);
    expect(can("ACCOUNTANT", "VIEW_ID_CARDS")).toBe(false);
    expect(can("TEACHER", "VIEW_OWN_STAFF_ID_CARD")).toBe(true);
    expect(can("TEACHER", "USE_ID_CARD_LOOKUP")).toBe(false);
    expect(can("PARENT", "VIEW_OWN_STUDENT_ID_CARDS")).toBe(true);
    expect(can("PARENT", "VIEW_ID_CARDS")).toBe(false);
  });
  it("guards every sensitive API server-side", () => {
    const guards: Record<string,string> = {
      "app/api/id-cards/route.ts":"CREATE_ID_CARDS",
      "app/api/id-cards/[id]/workflow/route.ts":"REVOKE_ID_CARDS",
      "app/api/id-cards/templates/route.ts":"MANAGE_ID_CARD_TEMPLATES",
      "app/api/id-cards/number-series/route.ts":"MANAGE_ID_CARD_NUMBER_SERIES",
      "app/api/id-cards/batches/route.ts":"MANAGE_ID_CARD_BATCHES",
      "app/api/id-cards/lookup/route.ts":"USE_ID_CARD_LOOKUP",
      "app/api/id-cards/reports/export/route.ts":"EXPORT_ID_CARD_REPORTS",
      "app/api/parent/id-cards/route.ts":"VIEW_OWN_STUDENT_ID_CARDS",
      "app/api/teacher/id-card/route.ts":"VIEW_OWN_STAFF_ID_CARD"
    };
    for (const [file, permission] of Object.entries(guards)) expect(source(file), file).toContain(permission);
  });
  it("uses accessible in-app dialogs with every required label and no native dialogs", () => {
    const ui = source("components/identity-card-forms.tsx");
    for (const label of ["Approve ID Card","Issue ID Card","Issue Corrected ID Card","Replace Lost or Damaged ID Card","Revoke ID Card","Cancel ID Card","Approve ID Card Batch","Issue ID Card Batch","Cancel ID Card Batch"]) expect(ui).toContain(label);
    expect(ui).toContain('role="dialog"'); expect(ui).toContain('aria-modal="true"'); expect(ui).toContain("autoFocus");
    expect(ui).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
  });
  it("keeps workflow state changes and append-only events in the same transaction", () => {
    const cards = source("lib/identity-cards.ts"), batches = source("lib/id-card-batches.ts");
    for (const marker of ["transitionIdentityCard", "revokeIdentityCard", "cancelIdentityCard"]) {
      expect(cards.slice(cards.indexOf(`function ${marker}`), cards.indexOf("\n}", cards.indexOf(`function ${marker}`)) + 2), marker).toContain("$transaction");
    }
    for (const marker of ["createIdentityCardBatch", "previewIdentityCardBatch", "approveIdentityCardBatch", "cancelIdentityCardBatch"]) {
      expect(batches.slice(batches.indexOf(`function ${marker}`), batches.indexOf("\n}", batches.indexOf(`function ${marker}`)) + 2), marker).toContain("$transaction");
    }
  });
  it("uses exact cardNumber for Code 39 and an India-local safe CSV filename", () => {
    const detail = source("app/id-cards/[id]/page.tsx"), exportRoute = source("app/api/id-cards/reports/export/route.ts");
    expect(detail).toContain("renderCode39Svg(payload.cardNumber)");
    expect(detail).not.toContain("renderCode39Svg(card.student");
    expect(exportRoute).toContain("schoolDateKey()");
    expect(exportRoute).toContain("identity-card-report-");
  });
  it("keeps every ID-card table inside table-wrap and documents CR80", () => {
    for (const file of ["app/id-cards/page.tsx","app/id-cards/[id]/page.tsx","app/id-cards/templates/page.tsx","app/id-cards/batches/page.tsx","app/id-cards/batches/[id]/page.tsx"]) {
      const text = source(file); expect(text.match(/table-wrap/g)?.length ?? 0, file).toBeGreaterThanOrEqual(text.match(/<table>/g)?.length ?? 0);
    }
    const css = source("app/globals.css"), print = source("app/id-cards/[id]/print/page.tsx"), batchPrint = source("app/id-cards/batches/[id]/print/page.tsx");
    expect(css).toContain("85.6mm"); expect(css).toContain("53.98mm"); expect(css).toContain("identity-card-print-bw"); expect(css).toContain("identity-card-no-cut-guides");
    expect(print).toContain("Single Front"); expect(print).toContain("Single Back"); expect(print).toContain("Front / Back Pair"); expect(print).toContain("Black &amp; White Output");
    expect(print).toContain('effectiveStatus: version.versionNumber === card.currentVersionNumber ? currentPayload.effectiveStatus : "SUPERSEDED"');
    expect(source("app/id-cards/[id]/page.tsx")).toContain("Print v{row.versionNumber}");
    expect(batchPrint).toContain("Colour + Guides"); expect(batchPrint).toContain("B&amp;W, No Guides");
  });
});
