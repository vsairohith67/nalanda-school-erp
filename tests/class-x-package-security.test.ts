import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
function source(path: string) { return readFileSync(path, "utf8"); }

describe("Class X package server and UI boundaries", () => {
  it("guards staff, finance, custody, reports, and Parent APIs by action", () => {
    const guards: Record<string, string> = {
      "app/api/class-x-documents/route.ts": "MANAGE_CLASS_X_PACKAGES",
      "app/api/class-x-documents/[id]/documents/[itemId]/link-certificate/route.ts": "MANAGE_CLASS_X_DOCUMENT_CUSTODY",
      "app/api/class-x-documents/[id]/payment/approve/route.ts": "APPROVE_CLASS_X_PACKAGE_CHARGES",
      "app/api/class-x-documents/[id]/payment/collect/route.ts": "COLLECT_CLASS_X_PACKAGE_PAYMENTS",
      "app/api/class-x-documents/[id]/payment/waive/route.ts": "WAIVE_CLASS_X_PACKAGE_CHARGES",
      "app/api/class-x-documents/[id]/handover/route.ts": "HANDOVER_CLASS_X_DOCUMENTS",
      "app/api/class-x-documents/reports/export/route.ts": "EXPORT_CLASS_X_PACKAGE_REPORTS",
      "app/api/parent/class-x-documents/route.ts": "VIEW_OWN_CHILD_CLASS_X_PACKAGE"
    };
    for (const [file, permission] of Object.entries(guards)) expect(source(file), file).toContain(permission);
  });
  it("guards all pages server-side", () => {
    for (const file of ["app/class-x-documents/page.tsx","app/class-x-documents/new/page.tsx","app/class-x-documents/[id]/page.tsx","app/class-x-documents/[id]/documents/page.tsx","app/class-x-documents/[id]/payment/page.tsx","app/class-x-documents/[id]/handover/page.tsx","app/class-x-documents/templates/page.tsx","app/class-x-documents/reports/page.tsx"]) expect(source(file), file).toContain("requirePermission(");
    expect(source("app/parent/class-x-documents/page.tsx")).toContain('requireRolePermission("VIEW_OWN_CHILD_CLASS_X_PACKAGE", "PARENT")');
    expect(source("app/api/parent/class-x-documents/route.ts")).toContain('requireApiRolePermission("VIEW_OWN_CHILD_CLASS_X_PACKAGE", "PARENT")');
    expect(source("app/api/parent/class-x-documents/route.ts")).toContain('requireApiRolePermission("REQUEST_OWN_CHILD_CLASS_X_PACKAGE", "PARENT")');
  });
  it("uses accessible in-app dialogs and no native dialog calls", () => {
    const forms = source("components/class-x-package-forms.tsx");
    expect(forms).toContain('role="dialog"');
    expect(forms).toContain('aria-modal="true"');
    for (const title of ["Submit Class X Package","Start Package Review","Approve Package Charge","Collect Package Payment","Waive Document Package Charge","Approve Class X Package","Record Board Document Receipt","Verify Board Document","Record Document Handover","Complete Class X Package","Cancel Class X Package"]) expect(forms).toContain(title);
    expect(forms).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
  });
  it("never implements a Board certificate renderer or upload surface", () => {
    const custody = source("app/class-x-documents/[id]/documents/page.tsx"), schema = source("prisma/schema.prisma");
    expect(custody).toContain("No Board document generation");
    expect(schema).not.toContain("boardDocumentBody");
    expect(schema).not.toContain("boardDocumentFile");
    expect(source("lib/class-x-document-items.ts")).not.toContain("upload");
  });
  it("keeps every package table in a table-wrap", () => {
    for (const file of ["app/class-x-documents/page.tsx","app/class-x-documents/[id]/page.tsx","app/class-x-documents/[id]/documents/page.tsx","app/class-x-documents/[id]/handover/page.tsx","app/class-x-documents/templates/page.tsx","app/class-x-documents/reports/page.tsx","app/parent/class-x-documents/page.tsx"]) {
      const text = source(file), tables = text.match(/<table>/g)?.length ?? 0, wraps = text.match(/table-wrap/g)?.length ?? 0; expect(wraps, file).toBeGreaterThanOrEqual(tables);
    }
  });
  it("prints a safe A4 physical-signature acknowledgment", () => {
    const print = source("app/class-x-documents/[id]/handover/[handoverId]/print/page.tsx");
    expect(print).toContain("Recipient physical signature"); expect(print).toContain("School physical signature"); expect(print).toContain("not digital signatures"); expect(print).not.toContain("aadhaarNo"); expect(print).not.toContain("primaryMobile");
  });
});
