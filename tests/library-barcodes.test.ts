import { describe, expect, it } from "vitest";
import { barcodeBulkPreview, generatedBarcodeForAccession, normalizeBarcodeValue } from "@/lib/library-barcodes";
import { renderCode39Svg } from "@/lib/library-barcode-svg";
import { readFileSync } from "node:fs";
describe("library barcode helpers", () => {
  it("normalizes Code 39 identifiers and creates deterministic accession labels", () => { expect(normalizeBarcodeValue(" nps-lib-001 ")).toBe("NPS-LIB-001"); expect(normalizeBarcodeValue("nps lib 001")).toBe("NPS LIB 001"); expect(generatedBarcodeForAccession("lib 2026 001")).toBe("NPS-LIB-LIB-2026-001"); });
  it("rejects unsupported values rather than rendering decorative bars", () => { expect(() => normalizeBarcodeValue("ABC_1")).toThrow(/Code 39/); expect(() => renderCode39Svg("ABC_1")).toThrow(/Code 39/); });
  it("renders a standards-shaped Code 39 SVG with an explicit human-readable value", () => { const svg = renderCode39Svg("NPS-1"); expect(svg).toContain('aria-label="Code 39 barcode NPS-1"'); expect(svg).toContain(">NPS-1</text>"); expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThan(10); });
  it("creates deterministic no-write bulk previews and skips assigned copies", () => { const rows = barcodeBulkPreview([{ id: "a", accessionNumber: "ACC-1", barcodeValue: null }, { id: "b", accessionNumber: "ACC-2", barcodeValue: "OLD-2" }]); expect(rows).toMatchObject([{ status: "READY", barcodeValue: "NPS-LIB-ACC-1" }, { status: "SKIPPED", message: "Already assigned" }]); });
  it("keeps barcode corrections out of the general copy-detail workflow", () => { expect(readFileSync("lib/library-accession.ts", "utf8")).toContain("Use the Barcode & Scanner correction workflow to change a barcode"); });
  it("accepts repeated selected-label query values for multi-label printing", () => { expect(readFileSync("app/library/barcodes/labels/page.tsx", "utf8")).toContain("Array.isArray(params.accession)"); });
});
