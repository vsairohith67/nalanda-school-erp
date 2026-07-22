import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Prompt 10C UI source contracts", () => {
  it("keeps single UPI rows unnumbered until another row is added", () => {
    const source = readFileSync("components/payment-form.tsx", "utf8");

    expect(source).toContain("upiRows.length > 1");
    expect(source).toContain("UPI transaction {index + 1}");
    expect(source).toContain("Add another UPI transaction");
  });

  it("uses the clearer missing-reference audit override wording", () => {
    const source = readFileSync("components/payment-form.tsx", "utf8");

    expect(source).toContain("Allow saving without UTR/reference and record an audit warning");
    expect(source).toContain("Use only when the parent paid but the reference number is not available.");
  });

  it("keeps A5 as the receipt print default and hides internal account columns from the parent receipt", () => {
    const source = readFileSync("app/receipts/[receiptNo]/print/page.tsx", "utf8");

    expect(source).toContain(': "A5"');
    expect(source).toContain("publicModeLabel");
    expect(source).not.toContain("<th>Received account</th>");
    expect(source).not.toContain("<td>{row.receivedAccount}</td>");
  });

  it("keeps raw payment audit JSON behind advanced details", () => {
    const source = readFileSync("components/receipt-audit.tsx", "utf8");

    expect(source).toContain("audit-summary-grid");
    expect(source).toContain("Advanced / Raw details");
    expect(source.indexOf("audit-summary-grid")).toBeLessThan(source.indexOf("Advanced / Raw details"));
  });
});
