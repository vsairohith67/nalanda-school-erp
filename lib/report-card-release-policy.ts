import { evaluateReleaseFeatureFlag } from "@/lib/release-feature-flags";

export const KG_REPORT_CARD_V1_5_FLAG = {
  key: "kg-report-cards-v1-5",
  environment: "PRODUCTION",
  expectedVersion: 1
} as const;

export const KG_REPORT_CARD_DEFERRED_STATUS = "IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5" as const;
export const KG_REPORT_CARD_DEFERRED_MESSAGE = "KG report-card family is planned for V1.5 and is unavailable for new operational work in V1.";

export function kgReportCardOperationalAvailability() {
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
