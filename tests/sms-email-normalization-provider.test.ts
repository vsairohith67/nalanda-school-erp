import { describe, expect, it } from "vitest";
import { normalizeSmsEmailAddress } from "@/lib/sms-email-address";
import { normalizeSmsPhone, previewSmsPhone } from "@/lib/sms-email-phone";
import {
  GmailApiEmailProvider,
  MockEmailProvider,
  MockSmsProvider,
  UnavailableLiveSmsProvider,
  signMockSmsEmailWebhook
} from "@/lib/sms-email-provider";
import {
  estimateSmsSegments,
  renderSmsEmailTemplate,
  validateSmsEmailTemplateInput
} from "@/lib/sms-email-templates";
import { assertSmsEmailProfileCanSend, smsDltReadiness } from "@/lib/sms-email-profiles";

describe("Prompt 19C contact normalization and providers", () => {
  it("normalizes only authoritative single contacts and stores privacy-safe derivatives", () => {
    const sms = normalizeSmsPhone("+91 98765 43210");
    expect(sms.canonical).toBe("+919876543210");
    expect(sms.masked).not.toContain("9876543210");
    expect(sms.contactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => normalizeSmsPhone("9876543210")).toThrow(/country code/i);
    expect(previewSmsPhone("9876543210")).toMatchObject({ canonical: "+919876543210", usedDefaultCountryCode: true });

    const email = normalizeSmsEmailAddress("Office.User@NALANDAPS.COM");
    expect(email.canonical).toBe("Office.User@nalandaps.com");
    expect(email.masked).toBe("O***@nalandaps.com");
    expect(email.contactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => normalizeSmsEmailAddress("Name <person@example.com>")).toThrow(/plain email/i);
    expect(() => normalizeSmsEmailAddress("one@example.com,two@example.com")).toThrow(/plain email/i);
  });

  it("keeps MOCK sends deterministic and verifies only signed delivery-status fixtures", async () => {
    const sms = new MockSmsProvider();
    const email = new MockEmailProvider();
    const input = {
      to: "+919876543210", renderedText: "School update", dltPrincipalEntityReference: "PE",
      dltHeader: "NALNDA", dltTemplateId: "DLT-1", requestFingerprint: "same-fingerprint"
    };
    const first = await sms.sendApprovedTemplate(input);
    const second = await sms.sendApprovedTemplate(input);
    expect(first.providerMessageId).toBe(second.providerMessageId);
    expect(first.status).toBe("SENT");
    const accepted = await email.sendPlainText({
      to: "parent@example.com", from: "school@example.com", subject: "Update",
      text: "Plain text", requestFingerprint: "email-fingerprint"
    });
    expect(accepted).toMatchObject({ accepted: true, status: "ACCEPTED" });

    const raw = JSON.stringify({ events: [{ providerMessageId: first.providerMessageId, status: "DELIVERED" }] });
    const signature = signMockSmsEmailWebhook(raw);
    expect(sms.verifyWebhookSignature(raw, signature)).toBe(true);
    expect(sms.verifyWebhookSignature(raw, "sha256=bad")).toBe(false);
    expect(sms.parseDeliveryWebhook(JSON.parse(raw))[0]).toMatchObject({ mappedStatus: "DELIVERED", eventType: "DELIVERY_STATUS" });
  });

  it("fails closed for unselected LIVE SMS and disabled Gmail API sending", async () => {
    const liveSms = new UnavailableLiveSmsProvider();
    expect(await liveSms.healthCheck()).toMatchObject({ ok: false, message: "SMS provider selection required." });
    expect((await liveSms.sendApprovedTemplate()).providerErrorCode).toBe("SMS_PROVIDER_REQUIRED");

    const previous = process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED;
    delete process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED;
    try {
      const result = await new GmailApiEmailProvider().sendPlainText({
        to: "parent@example.com", from: "school@example.com", subject: "Update",
        text: "Plain text", requestFingerprint: "disabled"
      });
      expect(result).toMatchObject({ accepted: false, providerErrorCode: "LIVE_SENDING_DISABLED" });
    } finally {
      if (previous == null) delete process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED;
      else process.env.SMS_EMAIL_EMAIL_LIVE_ENABLED = previous;
    }
  });

  it("enforces allowlisted exact templates and reports SMS segments as estimates", () => {
    const mapping = validateSmsEmailTemplateInput({
      mappingCode: "QA19C_SMS_GENERAL", integrationProfileId: "profile", channel: "SMS",
      notificationCategory: "GENERAL", internalPurpose: "Operational school update",
      providerStatus: "APPROVED", smsPrincipalEntityReference: "PE-1", smsHeader: "NALNDA",
      smsDltTemplateId: "DLT-1", smsTemplateText: "{{schoolName}}: {{notificationTitle}}",
      parameterDefinition: ["schoolName", "notificationTitle"]
    });
    const rendered = renderSmsEmailTemplate(mapping, { title: "Holiday notice", body: "Tomorrow is closed." });
    expect(rendered.body).toBe("Nalanda Public School: Holiday notice");
    expect(estimateSmsSegments("A".repeat(161))).toMatchObject({ encoding: "GSM_COMPATIBLE", segments: 2 });
    expect(() => validateSmsEmailTemplateInput({
      ...mapping, mappingCode: "QA19C_BAD", smsTemplateText: "Balance {{feeBalance}}",
      parameterDefinition: ["feeBalance"]
    })).toThrow(/sensitive|allowlisted/i);
    expect(estimateSmsSegments("\u0928".repeat(71))).toMatchObject({ encoding: "UNICODE", segments: 2 });
  });

  it("rejects every HTML tag and external URL before Email provider construction", () => {
    const base = {
      mappingCode: "QA19C_EMAIL_GENERAL", integrationProfileId: "profile", channel: "EMAIL",
      notificationCategory: "GENERAL", internalPurpose: "Operational school update",
      providerStatus: "APPROVED", emailSenderAlias: "school@nalandaps.com",
      emailSubjectTemplate: "{{notificationTitle}}", parameterDefinition: ["notificationTitle"]
    };
    expect(() => validateSmsEmailTemplateInput({
      ...base, emailTextTemplate: "Read <a href=\"/parent\">the portal</a>."
    })).toThrow(/plain text|HTML/i);
    expect(() => validateSmsEmailTemplateInput({
      ...base, emailTextTemplate: "Read https://example.com/unsafe."
    })).toThrow(/external link/i);
    expect(() => validateSmsEmailTemplateInput({
      ...base, emailTextTemplate: "Read Nalanda Parent Portal."
    })).not.toThrow();
  });

  it("enforces exact Principal Entity and registered-header identity in MOCK as well as LIVE", async () => {
    const profile = {
      channel: "SMS", mode: "MOCK", providerKind: "MOCK_SMS", status: "ACTIVE",
      dltPrincipalEntityReference: "PE-1", dltHeaderReference: "NALNDA"
    };
    const mapping = {
      providerStatus: "APPROVED", smsPrincipalEntityReference: "PE-1", smsHeader: "NALNDA",
      smsDltTemplateId: "DLT-1", smsTemplateText: "Approved text"
    };
    expect(smsDltReadiness(profile, mapping)).toMatchObject({ ready: true });
    await expect(assertSmsEmailProfileCanSend(profile, { ...mapping, smsHeader: "WRONG" }))
      .rejects.toThrow(/DLT readiness|registered identity/i);
    await expect(assertSmsEmailProfileCanSend(profile, { ...mapping, smsPrincipalEntityReference: "PE-2" }))
      .rejects.toThrow(/DLT readiness|registered identity/i);
    await expect(assertSmsEmailProfileCanSend(profile, mapping)).resolves.toBeUndefined();
  });

  it("covers deterministic MOCK retry, rate-limit, permanent, bounce, complaint and suppression outcomes", async () => {
    const sms = new MockSmsProvider();
    const email = new MockEmailProvider();
    const smsBase = {
      to: "+919876543210", renderedText: "School update", dltPrincipalEntityReference: "PE",
      dltHeader: "NALNDA", dltTemplateId: "DLT-1", requestFingerprint: "sms-outcomes"
    };
    expect(await sms.sendApprovedTemplate({ ...smsBase, mockOutcome: "RETRYABLE_FAILURE" }))
      .toMatchObject({ accepted: false, retryable: true, providerErrorCode: "MOCK_RETRYABLE" });
    expect(await sms.sendApprovedTemplate({ ...smsBase, mockOutcome: "PROVIDER_RATE_LIMIT" }))
      .toMatchObject({ accepted: false, retryable: true, providerErrorCode: "MOCK_429" });
    expect(await sms.sendApprovedTemplate({ ...smsBase, mockOutcome: "PERMANENT_FAILURE" }))
      .toMatchObject({ accepted: false, retryable: false, providerErrorCode: "MOCK_PERMANENT_FAILURE" });
    for (const mockOutcome of ["HARD_BOUNCE", "COMPLAINT", "SUPPRESSED"]) {
      expect(await email.sendPlainText({
        to: "parent@example.com", from: "school@example.com", subject: "Update",
        text: "Plain text", requestFingerprint: `email-${mockOutcome}`, mockOutcome
      })).toMatchObject({ accepted: false, retryable: false, providerErrorCode: `MOCK_${mockOutcome}` });
    }
  });
});
