import { describe, expect, it } from "vitest";
import { hashWhatsAppPhone, maskWhatsAppPhone, normalizeWhatsAppPhone, WhatsAppPhoneError } from "@/lib/whatsapp-phone";
import { parseParameterDefinition, renderWhatsAppTemplateParameters, validateWhatsAppTemplateMappingInput } from "@/lib/whatsapp-template-mappings";

describe("Prompt 19B phone identity", () => {
  it("normalises explicit E.164 and removes approved visual separators", () => {
    expect(normalizeWhatsAppPhone("+91 98765-43210")).toMatchObject({
      e164: "+919876543210", countryCode: "+91", phoneLast4: "3210", usedDefaultCountryCode: false
    });
  });
  it("does not invent a country code", () => {
    expect(() => normalizeWhatsAppPhone("9876543210")).toThrowError(WhatsAppPhoneError);
    try { normalizeWhatsAppPhone("9876543210"); } catch (error) { expect((error as WhatsAppPhoneError).code).toBe("MISSING_COUNTRY_CODE"); }
  });
  it("allows an explicitly previewed configurable default", () => {
    expect(normalizeWhatsAppPhone("09876543210", { defaultCountryCode: "+91", allowDefaultCountryCode: true })).toMatchObject({
      e164: "+919876543210", usedDefaultCountryCode: true
    });
  });
  it.each([
    ["+91 12345 67890", "NOT_MOBILE"],
    ["+91 98765 43210 ext 2", "EXTENSION"],
    ["+91/9876543210", "MALFORMED"],
    ["+0000", "INVALID_E164"]
  ])("rejects %s as %s", (source, code) => {
    try { normalizeWhatsAppPhone(source); throw new Error("expected rejection"); }
    catch (error) { expect((error as WhatsAppPhoneError).code).toBe(code); }
  });
  it("masks and hashes without persisting the full number", () => {
    const hash = hashWhatsAppPhone("+919876543210");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("9876543210");
    expect(maskWhatsAppPhone("+919876543210")).toContain("3210");
    expect(maskWhatsAppPhone("+919876543210")).not.toContain("9876543210");
  });
});

describe("Prompt 19B approved template rules", () => {
  const valid = {
    mappingCode: "GENERAL_UTILITY_EN", integrationProfileId: "profile", notificationCategory: "GENERAL",
    internalPurpose: "General operational update", metaTemplateName: "school_operational_update",
    metaTemplateLanguage: "en_US", metaTemplateCategory: "UTILITY", providerStatus: "APPROVED",
    parameterDefinition: ["school_name", "campaign_title", "recipient_label", "child_context"]
  };
  it("accepts only the strict parameter allowlist", () => {
    expect(validateWhatsAppTemplateMappingInput(valid).mappingCode).toBe("GENERAL_UTILITY_EN");
    expect(() => validateWhatsAppTemplateMappingInput({ ...valid, parameterDefinition: ["student_name"] })).toThrow(/not allowlisted/);
    expect(() => parseParameterDefinition(["school_name", "school_name"])).toThrow(/unique/);
  });
  it("blocks authentication and OTP category use", () => {
    expect(() => validateWhatsAppTemplateMappingInput({ ...valid, metaTemplateCategory: "AUTHENTICATION" })).toThrow(/OTP is out of scope/);
  });
  it("renders generic multi-child context without Student names", () => {
    const parameters = renderWhatsAppTemplateParameters(
      { parameterDefinitionJson: JSON.stringify(valid.parameterDefinition) },
      { title: "School reopens Monday", category: "GENERAL" },
      { type: "GUARDIAN", childCount: 2 }
    );
    expect(parameters).toContainEqual({ name: "child_context", value: "your linked children" });
    expect(JSON.stringify(parameters)).not.toContain("Student");
  });
  it("rejects sensitive campaign-title rendering", () => {
    expect(() => renderWhatsAppTemplateParameters(
      { parameterDefinitionJson: JSON.stringify(["campaign_title"]) },
      { title: "Fee balance for student ID 10", category: "GENERAL" }, { type: "GUARDIAN" }
    )).toThrow(/prohibited/);
  });
});
