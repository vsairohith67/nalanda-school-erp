export const OCR_SYNTHETIC_RETENTION_POLICY = Object.freeze({
  version: "OCR-1B-SYNTHETIC-1",
  operationalUseAuthorized: false,
  sourceDocumentHours: 24,
  temporaryRasterHours: 6,
  rawOcrOutputHours: 1,
  candidateFieldsDays: 7,
  auditMetadataDays: 30,
  backupBoundary: ["workflow metadata", "human review decisions", "submission receipts", "audit events"] as const,
  excludedFromLongTermBackup: ["source documents", "temporary rasters", "full raw OCR output", "rejected crops"] as const
});

function addHours(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 3_600_000);
}

function addDays(now: Date, days: number) {
  return addHours(now, days * 24);
}

export function syntheticOcrRetentionDates(now = new Date()) {
  return {
    retentionPolicyVersion: OCR_SYNTHETIC_RETENTION_POLICY.version,
    sourceRetentionUntil: addHours(now, OCR_SYNTHETIC_RETENTION_POLICY.sourceDocumentHours),
    rasterRetentionUntil: addHours(now, OCR_SYNTHETIC_RETENTION_POLICY.temporaryRasterHours),
    rawOutputRetentionUntil: addHours(now, OCR_SYNTHETIC_RETENTION_POLICY.rawOcrOutputHours),
    candidateRetentionUntil: addDays(now, OCR_SYNTHETIC_RETENTION_POLICY.candidateFieldsDays),
    auditRetentionUntil: addDays(now, OCR_SYNTHETIC_RETENTION_POLICY.auditMetadataDays)
  };
}
