import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serializeVendor, validateVendorInput, vendorWhere } from "../lib/vendors";

const base = { vendorCode: "v-001", name: "Nalanda Supplies" };
describe("vendor foundation", () => {
  it("normalizes vendor code and status", () => expect(validateVendorInput(base)).toMatchObject({ vendorCode: "V-001", status: "ACTIVE" }));
  it("validates mobile and email formats", () => { expect(validateVendorInput({ ...base, mobile: "+91 98765 43210", email: "vendor@example.com" }).email).toBe("vendor@example.com"); expect(() => validateVendorInput({ ...base, mobile: "12" })).toThrow("mobile"); expect(() => validateVendorInput({ ...base, email: "bad" })).toThrow("email"); });
  it("checks GSTIN/PAN formats without claiming verification", () => { expect(validateVendorInput({ ...base, gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F" }).gstin).toBe("29ABCDE1234F1Z5"); expect(() => validateVendorInput({ ...base, gstin: "INVALID" })).toThrow("does not verify"); expect(() => validateVendorInput({ ...base, pan: "INVALID" })).toThrow("does not verify"); });
  it("stores only four bank-account digits", () => { expect(validateVendorInput({ ...base, accountLastFour: "1234" }).accountLastFour).toBe("1234"); expect(() => validateVendorInput({ ...base, accountLastFour: "12345" })).toThrow("four"); });
  it("rejects overlong identifiers instead of silently truncating them", () => { expect(() => validateVendorInput({ ...base, gstin: "29ABCDE1234F1Z5EXTRA" })).toThrow("at most 15"); expect(() => validateVendorInput({ ...base, pan: "ABCDE1234FEXTRA" })).toThrow("at most 10"); });
  it("validates IFSC and payment terms", () => { expect(validateVendorInput({ ...base, ifsc: "HDFC0001234", paymentTermsDays: 30 })).toMatchObject({ ifsc: "HDFC0001234", paymentTermsDays: 30 }); expect(() => validateVendorInput({ ...base, ifsc: "BAD" })).toThrow("does not verify"); });
  it("allows only active/inactive/blocked statuses", () => expect(() => validateVendorInput({ ...base, status: "DELETED" })).toThrow("Unsupported"));
  it("hides sensitive fields from restricted serializers", () => { const row = { id: "v1", ...base, gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", bankName: "Bank", accountLastFour: "1234", ifsc: "HDFC0001234" }; const safe = serializeVendor(row, false); expect(safe).not.toHaveProperty("gstin"); expect(safe).not.toHaveProperty("pan"); expect(safe).not.toHaveProperty("accountLastFour"); });
  it("shows sensitive fields only with explicit management access", () => expect(serializeVendor({ ...base, gstin: "GST", pan: "PAN" }, true)).toMatchObject({ gstin: "GST", pan: "PAN" }));
  it("limits GSTIN search to sensitive access", () => { expect(JSON.stringify(vendorWhere("GST", "ACTIVE", false))).not.toContain("gstin"); expect(JSON.stringify(vendorWhere("GST", "ACTIVE", true))).toContain("gstin"); });
  it("does not serialize the editable vendor form for read-only detail access", () => { const source = readFileSync("app/vendors/[id]/page.tsx", "utf8"); expect(source).toContain("const formVendor = manage ?"); expect(source).toContain("manage && formVendor ? <VendorForm"); });
  it("requires confirmation before changing a vendor status", () => { const source = readFileSync("components/vendor-form.tsx", "utf8"); expect(source).toContain("Change vendor status from"); expect(source).toContain("Existing expense history will be preserved"); });
});
