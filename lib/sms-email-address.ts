import { hashSmsEmailContact } from "@/lib/sms-email-contact-hash";

export class SmsEmailAddressError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

const LOCAL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/;
const DOMAIN_LABEL = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;

export function normalizeSmsEmailAddress(source: string | null | undefined) {
  const raw = String(source ?? "").trim();
  if (!raw) throw new SmsEmailAddressError("A current Guardian or Staff email address is required.", "NO_EMAIL");
  if (/[<>]/.test(raw) || raw.includes(",")) {
    throw new SmsEmailAddressError("Use one plain email address without a display name or address list.", "INVALID_EMAIL");
  }
  if (/[\r\n\t ]/.test(raw)) throw new SmsEmailAddressError("Email address contains unsupported whitespace.", "INVALID_EMAIL");
  const at = raw.lastIndexOf("@");
  if (at <= 0 || at !== raw.indexOf("@") || at === raw.length - 1) {
    throw new SmsEmailAddressError("Email address is invalid.", "INVALID_EMAIL");
  }
  const localPart = raw.slice(0, at);
  const domain = raw.slice(at + 1).toLowerCase();
  const labels = domain.split(".");
  if (!LOCAL.test(localPart) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")
    || domain.length > 253 || labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) {
    throw new SmsEmailAddressError("Email address is invalid.", "INVALID_EMAIL");
  }
  const canonical = `${localPart}@${domain}`;
  return {
    canonical,
    contactHash: hashSmsEmailContact("EMAIL", canonical),
    masked: maskSmsEmailAddress(canonical)
  };
}

export function maskSmsEmailAddress(canonical: string) {
  const [local, domain] = canonical.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

