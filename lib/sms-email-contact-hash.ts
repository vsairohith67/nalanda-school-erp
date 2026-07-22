import { createHmac } from "node:crypto";
import { securitySecret } from "@/lib/security-secrets";

export function hashSmsEmailContact(channel: "SMS" | "EMAIL", canonicalContact: string) {
  const pepper = securitySecret("SMS_EMAIL_CONTACT_HASH_PEPPER");
  const value = `nalanda-sms-email-v2|${channel}|${canonicalContact}`;
  return createHmac("sha256", pepper).update(value).digest("hex");
}
