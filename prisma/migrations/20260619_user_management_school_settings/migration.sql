CREATE TABLE "SchoolSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'school',
  "schoolName" TEXT NOT NULL DEFAULT 'Nalanda Public School',
  "addressLine1" TEXT NOT NULL DEFAULT 'Nanalnagar, Mehdipatnam',
  "city" TEXT NOT NULL DEFAULT 'Hyderabad',
  "phone" TEXT NOT NULL DEFAULT '040-23513913',
  "academicYear" TEXT NOT NULL DEFAULT '2026-27',
  "receiptPrefix" TEXT,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
  "whatsappReminderFooter" TEXT NOT NULL DEFAULT 'Nalanda Public School',
  "logoPath" TEXT NOT NULL DEFAULT '/nalanda-logo.jpg',
  "receiptTitle" TEXT NOT NULL DEFAULT 'FEE RECEIPT',
  "showSchoolPhone" BOOLEAN NOT NULL DEFAULT true,
  "showSchoolAddress" BOOLEAN NOT NULL DEFAULT true,
  "defaultPrintSize" TEXT NOT NULL DEFAULT 'A5',
  "signatureLabel" TEXT NOT NULL DEFAULT 'Receiver Signature',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "targetUserId" TEXT,
  "detailsJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "UserAudit_action_idx" ON "UserAudit"("action");
CREATE INDEX "UserAudit_actorUserId_idx" ON "UserAudit"("actorUserId");
CREATE INDEX "UserAudit_targetUserId_idx" ON "UserAudit"("targetUserId");
CREATE INDEX "UserAudit_createdAt_idx" ON "UserAudit"("createdAt");
