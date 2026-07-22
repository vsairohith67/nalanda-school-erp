import { describe, expect, it } from "vitest";
import { allocateIdentityCardNumber, formatIdentityCardNumber, previewIdentityCardNumber, validateIdentityCardSeriesInput } from "@/lib/id-card-numbering";
import { defaultIdentityCardDefinitions, validateIdentityCardSideDefinition, validateIdentityCardTemplateInput } from "@/lib/id-card-templates";

function seriesClient(rows: any[], updateCount = 1) {
  let calls = 0;
  return {
    get updateCalls() { return calls; },
    identityCardNumberSeries: {
      findMany: async () => rows,
      updateMany: async () => { calls++; return { count: updateCount }; }
    }
  };
}

describe("Prompt 18C ID-card numbering", () => {
  it("formats opaque numbers and validates series boundaries", () => {
    expect(formatIdentityCardNumber({ prefix: "NPS-ID-", nextNumber: 12, paddingLength: 5, suffix: "-S" })).toBe("NPS-ID-00012-S");
    expect(validateIdentityCardSeriesInput({ seriesCode: " qa18c stu ", cardType: "student", nextNumber: 1, paddingLength: 10 })).toMatchObject({ seriesCode: "QA18C-STU", cardType: "STUDENT", nextNumber: 1 });
    expect(() => validateIdentityCardSeriesInput({ cardType: "OTHER" })).toThrow(/STUDENT or STAFF/);
    expect(() => validateIdentityCardSeriesInput({ cardType: "STAFF", nextNumber: 0 })).toThrow(/positive/);
  });
  it("previews without consuming a number", async () => {
    const client = seriesClient([{ id: "s", academicYear: "2026-27", prefix: "STU-", nextNumber: 7, paddingLength: 4, suffix: null }]);
    await expect(previewIdentityCardNumber(client as never, "STUDENT", "2026-27")).resolves.toMatchObject({ cardNumber: "STU-0007", nextNumber: 7 });
    expect(client.updateCalls).toBe(0);
  });
  it("allocates only during issue with compare-and-set behavior", async () => {
    const client = seriesClient([{ id: "s", academicYear: "2026-27", prefix: "STAFF-", nextNumber: 3, paddingLength: 3, suffix: null }]);
    await expect(allocateIdentityCardNumber(client as never, "STAFF", "2026-27")).resolves.toMatchObject({ cardNumber: "STAFF-003" });
    expect(client.updateCalls).toBe(1);
    await expect(allocateIdentityCardNumber(seriesClient([{ id: "s", academicYear: null, prefix: "X", nextNumber: 1, paddingLength: 1, suffix: null }], 0) as never, "STAFF", null)).rejects.toThrow(/another issue operation/);
  });
  it("blocks missing and ambiguous applicable series", async () => {
    await expect(previewIdentityCardNumber(seriesClient([]) as never, "STUDENT", "2026-27")).rejects.toThrow(/No active default/);
    const rows = [{ id: "1", academicYear: "2026-27", prefix: "A", nextNumber: 1, paddingLength: 1, suffix: null }, { id: "2", academicYear: "2026-27", prefix: "B", nextNumber: 1, paddingLength: 1, suffix: null }];
    await expect(previewIdentityCardNumber(seriesClient(rows) as never, "STUDENT", "2026-27")).rejects.toThrow(/Multiple active/);
  });
});

describe("Prompt 18C template allowlists", () => {
  it("accepts controlled Student and Staff defaults", () => {
    for (const type of ["STUDENT", "STAFF"] as const) {
      const definition = defaultIdentityCardDefinitions(type);
      expect(validateIdentityCardSideDefinition(type, definition.front, "front").fields.length).toBeGreaterThan(5);
      expect(validateIdentityCardSideDefinition(type, definition.back, "back").footer).toMatch(/not a government identity document/);
    }
  });
  it("rejects cross-type, prohibited, executable, and arbitrary fields", () => {
    expect(() => validateIdentityCardSideDefinition("STUDENT", { title: "Card", fields: ["salary"] }, "front")).toThrow(/prohibited|Unsupported/);
    expect(() => validateIdentityCardSideDefinition("STAFF", { title: "Card", fields: ["admissionNumber"] }, "front")).toThrow(/Unsupported/);
    expect(() => validateIdentityCardSideDefinition("STUDENT", { title: "<script>x</script>", fields: ["studentName"] }, "front")).toThrow(/unsafe/);
    expect(() => validateIdentityCardSideDefinition("STUDENT", { title: "Card", fields: ["studentName"], customCss: "x" }, "front")).toThrow(/Unsupported/);
  });
  it("keeps optional DOB/Guardian disabled unless explicitly listed and blocks required photos", () => {
    const defaults = defaultIdentityCardDefinitions("STUDENT");
    expect(defaults.front.fields).not.toContain("dateOfBirth");
    expect(defaults.front.fields).not.toContain("guardianName");
    expect(() => validateIdentityCardTemplateInput({ templateCode: "T", cardType: "STUDENT", name: "Safe", status: "ACTIVE", frontDefinition: defaults.front, backDefinition: defaults.back, photoRequired: true })).toThrow(/no managed/);
  });
});
