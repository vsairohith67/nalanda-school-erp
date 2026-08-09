import { createHash } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

const SECURITY_SECRET_NAMES = [
  "WHATSAPP_MOCK_WEBHOOK_SECRET",
  "WHATSAPP_MOCK_VERIFY_TOKEN",
  "SMS_EMAIL_MOCK_WEBHOOK_SECRET",
  "WHATSAPP_PHONE_HASH_PEPPER",
  "SMS_EMAIL_CONTACT_HASH_PEPPER",
  "AI_ASSISTANT_AUDIT_HASH_PEPPER",
  "SAFE_EXIT_GATE_PASS_SECRET"
] as const;

type SecuritySecretName = typeof SECURITY_SECRET_NAMES[number];
type Environment = Record<string, string | undefined>;

function nonProductionDefault(name: SecuritySecretName) {
  return createHash("sha256")
    .update(["nalanda", "non-production-only", name].join(":"), "utf8")
    .digest("hex");
}

export function securitySecret(
  name: SecuritySecretName,
  environment: Environment = process.env
) {
  const configured = environment[name]?.trim();
  if (configured) {
    if (configured.length < MIN_SECRET_LENGTH) {
      throw new Error(`${name} must contain at least ${MIN_SECRET_LENGTH} characters.`);
    }
    return configured;
  }
  if (environment.NODE_ENV === "production") {
    throw new Error(`${name} is required in production.`);
  }
  return nonProductionDefault(name);
}

export function webhookEventKey(value: unknown) {
  const key = String(value ?? "").trim();
  if (!key || key.length > 200) throw new Error("Webhook event key is invalid.");
  return key;
}

export function assertWebhookEventCount(events: readonly unknown[]) {
  if (events.length > 100) throw new Error("Webhook event count exceeds the supported maximum.");
}
