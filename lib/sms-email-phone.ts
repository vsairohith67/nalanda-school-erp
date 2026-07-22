import { normalizeWhatsAppPhone, WhatsAppPhoneError } from "@/lib/whatsapp-phone";
import { hashSmsEmailContact } from "@/lib/sms-email-contact-hash";

export class SmsPhoneError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export function normalizeSmsPhone(
  source: string | null | undefined,
  options: { defaultCountryCode?: string | null; allowDefaultCountryCode?: boolean } = {}
) {
  try {
    const phone = normalizeWhatsAppPhone(source, options);
    return {
      canonical: phone.e164,
      contactHash: hashSmsEmailContact("SMS", phone.e164),
      masked: `${phone.countryCode} ••••••${phone.phoneLast4}`,
      countryCode: phone.countryCode,
      last4: phone.phoneLast4,
      usedDefaultCountryCode: phone.usedDefaultCountryCode
    };
  } catch (error) {
    if (error instanceof WhatsAppPhoneError) {
      const code = error.code === "NO_PHONE" ? "NO_PHONE"
        : error.code === "MISSING_COUNTRY_CODE" ? "MISSING_COUNTRY_CODE"
        : "INVALID_PHONE";
      throw new SmsPhoneError(error.message.replace("WhatsApp delivery", "SMS delivery"), code);
    }
    throw error;
  }
}

export function previewSmsPhone(source: string | null | undefined, defaultCountryCode = "+91") {
  return normalizeSmsPhone(source, { defaultCountryCode, allowDefaultCountryCode: true });
}

