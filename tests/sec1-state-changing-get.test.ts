import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MUTATING_PRISMA_CALL = /\.(?:create|update|updateMany|delete|deleteMany|upsert)\s*\(/;

describe("SEC-1 state-changing GET prevention", () => {
  it.each([
    "app/id-cards/[id]/print/page.tsx",
    "app/id-cards/batches/[id]/print/page.tsx",
    "app/api/id-cards/[id]/print/route.ts",
    "app/api/fee-register-ocr/pages/[pageId]/image/route.ts"
  ])("keeps GET rendering and retrieval read-only: %s", (file) => {
    const source = readFileSync(file, "utf8");
    const getOnly = source.split(/export\s+async\s+function\s+POST/)[0];
    expect(getOnly).not.toMatch(MUTATING_PRISMA_CALL);
  });

  it("records ID-card print access only through explicit POST endpoints", () => {
    const cardRoute = readFileSync("app/api/id-cards/[id]/print/route.ts", "utf8");
    const batchRoute = readFileSync("app/api/id-cards/batches/[id]/print/route.ts", "utf8");
    const printButton = readFileSync("components/print-button.tsx", "utf8");

    expect(cardRoute).toContain("export async function POST");
    expect(batchRoute).toContain("export async function POST");
    expect(cardRoute).toContain('eventType: "PRINT_ACCESSED"');
    expect(batchRoute).toContain('eventType: "PRINT_ACCESSED"');
    expect(printButton).toContain('method: "POST"');
    expect(printButton).not.toContain("window.alert");
  });
});
