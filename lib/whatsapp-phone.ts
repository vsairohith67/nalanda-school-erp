import { createHmac } from "node:crypto";
import { securitySecret } from "@/lib/security-secrets";

export type WhatsAppPhoneResult = {
  e164: string;
  phoneHash: string;
  phoneLast4: string;
  countryCode: string;
  usedDefaultCountryCode: boolean;
  masked: string;
};

export class WhatsAppPhoneError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

const VISUAL_SEPARATORS = /[\s().-]/g;

export function normalizeWhatsAppPhone(
  source: string | null | undefined,
  options: { defaultCountryCode?: string | null; allowDefaultCountryCode?: boolean } = {}
): WhatsAppPhoneResult {
  const raw = String(source ?? "").trim();
  if (!raw) throw new WhatsAppPhoneError("A current Guardian or Staff mobile number is required.", "NO_PHONE");
  if (/(?:ext\.?|extension|x)\s*\d+/i.test(raw)) {
    throw new WhatsAppPhoneError("Phone extensions are not supported for WhatsApp delivery.", "EXTENSION");
  }
  if (!/^[+\d\s().-]+$/.test(raw)) {
    throw new WhatsAppPhoneError("The phone number contains unsupported characters.", "MALFORMED");
  }
  const compact = raw.replace(VISUAL_SEPARATORS, "");
  let e164 = compact;
  let usedDefaultCountryCode = false;
  if (!e164.startsWith("+")) {
    if (!options.allowDefaultCountryCode) {
      throw new WhatsAppPhoneError("The phone number has no country code. Preview a configured default explicitly.", "MISSING_COUNTRY_CODE");
    }
    const defaultCode = normalizeCountryCode(options.defaultCountryCode);
    let national = e164.replace(/^0+/, "");
    if (!national) throw new WhatsAppPhoneError("The phone number is incomplete.", "MALFORMED");
    e164 = `${defaultCode}${national}`;
    usedDefaultCountryCode = true;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new WhatsAppPhoneError("The phone number is not a plausible E.164 mobile number.", "INVALID_E164");
  }
  const countryCode = inferCountryCode(e164);
  const national = e164.slice(countryCode.length);
  if (countryCode === "+91" && !/^[6-9]\d{9}$/.test(national)) {
    throw new WhatsAppPhoneError("The Indian number is not a supported 10-digit mobile number.", "NOT_MOBILE");
  }
  return {
    e164,
    phoneHash: hashWhatsAppPhone(e164),
    phoneLast4: e164.slice(-4),
    countryCode,
    usedDefaultCountryCode,
    masked: maskWhatsAppPhone(e164)
  };
}

export function previewWhatsAppPhone(source: string | null | undefined, defaultCountryCode = "+91") {
  return normalizeWhatsAppPhone(source, { defaultCountryCode, allowDefaultCountryCode: true });
}

export function hashWhatsAppPhone(e164: string) {
  const pepper = securitySecret("WHATSAPP_PHONE_HASH_PEPPER");
  return createHmac("sha256", pepper)
    .update(`nalanda-whatsapp-phone-v2|${e164}`)
    .digest("hex");
}

export function maskWhatsAppPhone(e164: string) {
  const countryCode = inferCountryCode(e164);
  return `${countryCode} ••••••${e164.slice(-4)}`;
}

export function normalizeCountryCode(value: string | null | undefined) {
  const code = String(value ?? "").trim().replace(VISUAL_SEPARATORS, "");
  if (!/^\+[1-9]\d{0,3}$/.test(code)) {
    throw new WhatsAppPhoneError("Default country code must be in +NN format.", "INVALID_COUNTRY_CODE");
  }
  return code;
}

function inferCountryCode(e164: string) {
  if (e164.startsWith("+91")) return "+91";
  if (e164.startsWith("+1")) return "+1";
  return e164.slice(0, Math.min(4, e164.length - 8));
}
