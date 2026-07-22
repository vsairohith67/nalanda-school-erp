import { MockWhatsAppProvider, signMockWhatsAppWebhook } from "@/lib/whatsapp-provider-mock";

const providerMessageId = process.argv.find((value) => value.startsWith("--message="))?.split("=")[1] ?? "wamid.mock.QA19B";
const statuses = ["sent", "delivered", "read"].map((status, index) => ({
  id: providerMessageId,
  status,
  timestamp: String(1784304000 + index)
}));
const payload = { object: "whatsapp_business_account", entry: [{ id: "QA19B", changes: [{ field: "messages", value: { statuses } }] }] };
const rawBody = JSON.stringify(payload);
const signature = signMockWhatsAppWebhook(rawBody);
const parsed = new MockWhatsAppProvider().parseDeliveryWebhook(payload);
if (!new MockWhatsAppProvider().verifyWebhookSignature(rawBody, signature)) throw new Error("Signed MOCK fixture did not verify.");
console.log(JSON.stringify({ rawBody, signature, parsed, invalidSignatureAccepted: new MockWhatsAppProvider().verifyWebhookSignature(rawBody, "sha256=bad") }, null, 2));
