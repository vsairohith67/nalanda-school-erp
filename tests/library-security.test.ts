import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const apiFiles = filesUnder("app/api/library").filter((file) => file.endsWith("route.ts"));
const pageFiles = filesUnder("app/library").filter((file) => file.endsWith("page.tsx"));

describe("library page and direct API security", () => {
  it("guards every library API server-side", () => { for (const file of apiFiles) expect(readFileSync(file, "utf8"), file).toContain("requireApiPermission("); });
  it("uses an explicit library write permission on every mutation route", () => { for (const file of apiFiles) { const source = readFileSync(file, "utf8"); if (/export async function (POST|PATCH)/.test(source)) expect(source, file).toMatch(/requireApiPermission\((?:"(?:MANAGE_LIBRARY|IMPORT_LIBRARY|ISSUE_LIBRARY|RETURN_LIBRARY|RENEW_LIBRARY|ASSESS_LIBRARY|APPROVE_LIBRARY|WAIVE_LIBRARY|COLLECT_LIBRARY|CANCEL_LIBRARY|SCAN_LIBRARY|REVIEW_LIBRARY|APPLY_LIBRARY|LOCK_LIBRARY)|permission as any)/); } });
  it("guards every library page server-side", () => { for (const file of pageFiles) expect(readFileSync(file, "utf8"), file).toContain("requirePermission("); });
  it("does not define library DELETE APIs", () => { for (const file of apiFiles) expect(readFileSync(file, "utf8"), file).not.toContain("function DELETE"); });
  it("permits scanner and stock verification while forbidding RFID, camera, payment-gateway, and procurement routes", () => { const tree = [...apiFiles, ...pageFiles].join("\n").replaceAll("\\", "/"); expect(tree).toContain("library/scanner"); expect(tree).toContain("library/stock-verification"); for (const forbidden of ["library/payment-gateway", "library/rfid", "library/camera", "library/procurement"]) expect(tree).not.toContain(forbidden); });
});
