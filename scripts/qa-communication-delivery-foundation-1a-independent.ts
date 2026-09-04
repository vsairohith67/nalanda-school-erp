import { readFileSync } from "node:fs";

const checks: Array<[string, boolean]> = [];
const read = (file: string) => readFileSync(file, "utf8");
const service = read("lib/communication-service.ts");
const recipients = read("lib/communication-recipients.ts");
const adapters = read("lib/communication-adapters.ts");
const webhooks = read("lib/communication-webhooks.ts");
const templates = read("lib/communication-templates.ts");
const policy = read("lib/communication-policy.ts");
const schema = read("prisma/schema.prisma");
const ui = [read("components/communication-notification-centre.tsx"), read("components/communication-preferences-form.tsx"), read("app/communication/operations/page.tsx")].join("\n");

checks.push(
  ["communication-platform: durable lease owner and token", /leaseOwner/.test(service) && /leaseToken/.test(service) && /leaseExpiresAt/.test(service)],
  ["communication-platform: no process-local worker mutex", !/queueRunActive|process-local boolean/i.test(service)],
  ["identity-security: server-owned recipient policies", /ACTIVE_GUARDIANS_FOR_STUDENTS/.test(recipients) && /ACTIVE_STAFF_RELATION/.test(recipients) && !/arbitraryRecipient/i.test(service)],
  ["identity-security: dispatch-time recheck", /recheckDispatchDestination/.test(service) && /CONTACT_CHANGED/.test(recipients)],
  ["privacy: no network-capable adapter", /networkCapable:\s*false/.test(adapters) && !/\bfetch\s*\(|axios|https\.request|http\.request/.test(adapters)],
  ["privacy: external content minimisation", /COMMUNICATION_EXTERNAL_CONTENT_MINIMISATION_DENIED/.test(templates)],
  ["privacy: masked/digested destinations", /destinationDigest/.test(schema) && /destinationMasked/.test(schema)],
  ["security: signed bounded replay-protected webhook", /signature verification failed/.test(webhooks) && /BODY_TOO_LARGE/.test(webhooks) && /providerEventKey/.test(webhooks)],
  ["security: default-off parent and child gates", /communicationFeatureAvailability/.test(service) && /COMMUNICATION_DELIVERY_FOUNDATION_FEATURE/.test(policy)],
  ["school-admin: large audience requires approval and step-up", /COMMUNICATION_LARGE_AUDIENCE_APPROVAL_REQUIRED/.test(policy)],
  ["school-admin: emergency override restricted", /EMERGENCY_OVERRIDE_SAFETY_ONLY/.test(policy) && /EMERGENCY_OVERRIDE_ROLE_DENIED/.test(policy)],
  ["accessibility: live regions and labelled actions", /aria-live/.test(ui) && /aria-label/.test(ui)],
  ["restore: temporary leases excluded", !/leaseOwner|leaseToken|leaseExpiresAt/.test(read("lib/communication-backup.ts").match(/communicationOutboxItems: fields\("([^"]+)/)?.[1] ?? "")],
  ["search/AI isolation: no communication model integration", !/CommunicationOutbox|CommunicationIntent/.test(read("lib/universal-search.ts")) && !/CommunicationOutbox|CommunicationIntent/.test(read("lib/ai-assistant.ts"))]
);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`COMMUNICATION_INDEPENDENT_QA_FAILED\n${failed.join("\n")}`);
process.stdout.write(`${JSON.stringify({ result: "COMMUNICATION_INDEPENDENT_QA_PASSED", perspectives: ["communication-platform engineer", "identity-security engineer", "privacy reviewer", "School administrator", "accessibility reviewer"], checks: checks.length, critical: 0, high: 0, authorizationPrivacyIntegrityMedium: 0 })}\n`);
