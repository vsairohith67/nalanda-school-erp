import { Prisma } from "@prisma/client";

export const WHATSAPP_COST_WARNING = "Estimate only. Meta pricing, template classification and charging rules may change. The ERP estimate may not equal the provider invoice.";
export const WHATSAPP_RATE_VERSION = "META-INR-2026-07-01-REVIEWED-2026-07-17";
export const WHATSAPP_RATE_SOURCE = "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing";

const INDIA_RATES = {
  MARKETING: "0.8631",
  UTILITY: "0.1150"
} as const;

export async function ensureWhatsAppRateReferences(client: any, integrationProfileId?: string | null) {
  for (const [templateCategory, rate] of Object.entries(INDIA_RATES)) {
    await client.whatsAppRateReference.upsert({
      where: { rateVersion_market_templateCategory_currency: {
        rateVersion: WHATSAPP_RATE_VERSION, market: "India", templateCategory, currency: "INR"
      } },
      update: {},
      create: {
        integrationProfileId: integrationProfileId ?? null,
        rateVersion: WHATSAPP_RATE_VERSION,
        market: "India",
        countryCallingCode: "+91",
        templateCategory,
        currency: "INR",
        ratePerDeliveredMessage: new Prisma.Decimal(rate),
        effectiveDate: new Date("2026-07-01T00:00:00+05:30"),
        sourceReviewDate: new Date("2026-07-17T00:00:00+05:30"),
        sourceUrl: WHATSAPP_RATE_SOURCE,
        notes: `${WHATSAPP_COST_WARNING} Current official INR rate card reviewed 17 July 2026.`
      }
    });
  }
}

export async function estimateWhatsAppBatchCost(client: any, eligible: number, category: string) {
  const row = await client.whatsAppRateReference.findFirst({
    where: { market: "India", templateCategory: category, currency: "INR", status: "ACTIVE" },
    orderBy: { effectiveDate: "desc" }
  });
  if (!row) return { estimatedCostMinor: null, currency: "INR", rateVersion: null, rate: null, warning: WHATSAPP_COST_WARNING };
  const rate = Number(row.ratePerDeliveredMessage);
  return {
    estimatedCostMinor: Math.round(eligible * rate * 100),
    currency: row.currency,
    rateVersion: row.rateVersion,
    rate,
    warning: WHATSAPP_COST_WARNING
  };
}
