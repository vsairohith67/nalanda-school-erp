import { evaluateReleaseFeatureFlag } from "@/lib/release-feature-flags";

export const KG_REPORT_CARD_V1_5_FLAG = {
  key: "kg-report-cards-v1-5",
  environment: "PRODUCTION",
  expectedVersion: 1
} as const;

export const KG_REPORT_CARD_V1_5_STATUS = "SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF" as const;
export const KG_REPORT_CARD_DEFERRED_STATUS = KG_REPORT_CARD_V1_5_STATUS;
export const KG_REPORT_CARD_DEFERRED_MESSAGE = "KG report-card V1.5 is software-cleared, but operational activation remains off.";
export const KG_REPORT_CARD_QA_MODE = "SYNTHETIC_COPY_ONLY" as const;

export function isKgReportCardSoftwareQaMode() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").replaceAll("\\", "/");
  const isolatedDatabase = /(?:^|\/)(?:tmp|temp|qa|test|copy|copied|synthetic)(?:\/|[-_.])/i.test(databaseUrl);
  const operationalDatabase = /(?:^|\/)prisma\/dev\.db(?:$|[?])/i.test(databaseUrl);
  return process.env.NODE_ENV !== "production"
    && process.env.KG_REPORT_CARDS_V1_5_QA_MODE === KG_REPORT_CARD_QA_MODE
    && isolatedDatabase
    && !operationalDatabase;
}

export function kgReportCardOperationalAvailability() {
  if (isKgReportCardSoftwareQaMode()) {
    return { enabled: true, reason: "SYNTHETIC_COPY_QA", version: KG_REPORT_CARD_V1_5_FLAG.expectedVersion } as const;
  }
  return evaluateReleaseFeatureFlag({
    ...KG_REPORT_CARD_V1_5_FLAG,
    role: "SUPER_ADMIN"
  });
}

export function isKgReportCardOperationallyAvailable() {
  return kgReportCardOperationalAvailability().enabled;
}

export function isV1OperationalReportType(reportType: string) {
  return reportType !== "KG_RUBRIC" || isKgReportCardOperationallyAvailable();
}
