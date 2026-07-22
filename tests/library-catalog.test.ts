import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visibleNavigationItems } from "@/lib/access-rules";
import { normalizeIsbn, normalizeLibraryTitleCode, serializeLibraryTitle, validateLibraryTitleInput } from "@/lib/library-catalog";
import { can, RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

describe("library bibliographic catalog foundation", () => {
  it("normalizes title codes deterministically", () => expect(normalizeLibraryTitleCode(" lib  2026 / 001 ")).toBe("LIB-2026-001"));
  it("normalizes ISBN punctuation for unique comparison", () => expect(normalizeIsbn("978-81-12345-67-8")).toBe("9788112345678"));
  it("rejects malformed ISBN instead of guessing", () => expect(() => normalizeIsbn("not-an-isbn")).toThrow("10 or 13"));
  it("validates title fields without physical-copy fields", () => expect(validateLibraryTitleInput({ titleCode: " t 1 ", title: "  A title ", authors: " Author ", isbn: "0-306-40615-2", status: "active" })).toMatchObject({ titleCode: "T-1", title: "A title", authors: "Author", isbn: "0306406152", status: "ACTIVE" }));
  it("allowlists title payloads and exposes only safe Vendor identity", () => { const serialized = serializeLibraryTitle({ id: "t", titleCode: "T", title: "Title", authors: "Author", status: "ACTIVE", publisherVendor: { id: "v", vendorCode: "V1", name: "Publisher", gstin: "secret", bankName: "secret" }, _count: { copies: 2 } }); expect(serialized.publisherVendor).toEqual({ id: "v", vendorCode: "V1", name: "Publisher" }); expect(JSON.stringify(serialized)).not.toContain("gstin"); expect(JSON.stringify(serialized)).not.toContain("bankName"); });
  it("keeps library and books-sales schemas separate", () => { const schema = readFileSync("prisma/schema.prisma", "utf8"); expect(schema).toContain("model LibraryTitle"); expect(schema).toContain("model LibraryCopy"); expect(schema).toContain("model BookCatalogItem"); expect(schema.match(/model LibraryTitle[\s\S]*?model LibraryCopy/)?.[0]).not.toContain("BookCatalogItem"); });
  it("enforces normalized title code and ISBN uniqueness in the database", () => { const schema = readFileSync("prisma/schema.prisma", "utf8"); const model = schema.match(/model LibraryTitle[\s\S]*?\n}/)?.[0] ?? ""; expect(model).toContain("titleCode"); expect(model).toMatch(/titleCode\s+String\s+@unique/); expect(model).toMatch(/isbn\s+String\?\s+@unique/); });
  it("uses conservative role defaults", () => { expect(can("DIRECTOR", "MANAGE_LIBRARY_COPIES")).toBe(true); expect(can("ADMIN", "IMPORT_LIBRARY_CATALOG")).toBe(true); expect(can("PRINCIPAL", "VIEW_LIBRARY_REPORTS")).toBe(true); expect(can("PRINCIPAL", "MANAGE_LIBRARY_CATALOG")).toBe(false); expect(can("VIEWER", "VIEW_LIBRARY")).toBe(true); expect(can("VIEWER", "EXPORT_LIBRARY_REPORTS")).toBe(false); for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) expect(can(role, "VIEW_LIBRARY")).toBe(false); });
  it("shows one permission-gated Library navigation item only to allowed roles", () => { expect(visibleNavigationItems(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR).filter((x) => x.href === "/library")).toHaveLength(1); for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) expect(visibleNavigationItems(RECOMMENDED_ROLE_PERMISSIONS[role]).some((x) => x.href === "/library")).toBe(false); });
});
