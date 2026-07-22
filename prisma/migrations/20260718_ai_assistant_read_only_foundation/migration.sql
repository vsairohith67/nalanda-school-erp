-- Prompt 20A: privacy-safe, read-only AI assistant foundation.
-- No provider credential, endpoint, full prompt, full answer, retrieved body, or private context is stored.
CREATE TABLE "AiAssistantProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "profileCode" TEXT NOT NULL, "name" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL DEFAULT 'MOCK', "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
  "allowedModesJson" TEXT NOT NULL DEFAULT '["DOCUMENTATION","AGGREGATE_OPERATIONS"]',
  "maximumQuestionLength" INTEGER NOT NULL DEFAULT 1000,
  "maximumContextCharacters" INTEGER NOT NULL DEFAULT 12000,
  "maximumToolCalls" INTEGER NOT NULL DEFAULT 3, "maximumRowsPerTool" INTEGER NOT NULL DEFAULT 100,
  "requestTimeoutMs" INTEGER NOT NULL DEFAULT 10000,
  "minimumAggregateGroupSize" INTEGER NOT NULL DEFAULT 5,
  "contentLoggingMode" TEXT NOT NULL DEFAULT 'HASH_ONLY', "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "providerModelReference" TEXT, "lastHealthCheckAt" DATETIME, "lastHealthCheckStatus" TEXT,
  "lastHealthCheckMessage" TEXT, "activatedByUserId" TEXT, "pausedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AiAssistantProfile_profileCode_key" ON "AiAssistantProfile"("profileCode");
CREATE INDEX "AiAssistantProfile_providerKind_status_idx" ON "AiAssistantProfile"("providerKind","status");
CREATE INDEX "AiAssistantProfile_liveUseEnabled_idx" ON "AiAssistantProfile"("liveUseEnabled");

CREATE TABLE "AiAssistantSourcePolicy" (
  "id" TEXT NOT NULL PRIMARY KEY, "policyCode" TEXT NOT NULL, "sourceType" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL, "displayName" TEXT NOT NULL, "description" TEXT NOT NULL,
  "allowedRolesJson" TEXT NOT NULL, "allowedModesJson" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "minimumGroupSize" INTEGER, "maximumRows" INTEGER, "freshnessWarningDays" INTEGER,
  "prohibitedFieldKeysJson" TEXT NOT NULL, "citationLabel" TEXT NOT NULL,
  "createdByUserId" TEXT, "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_policyCode_key" ON "AiAssistantSourcePolicy"("policyCode");
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_sourceType_sourceKey_key" ON "AiAssistantSourcePolicy"("sourceType","sourceKey");
CREATE INDEX "AiAssistantSourcePolicy_enabled_sourceType_idx" ON "AiAssistantSourcePolicy"("enabled","sourceType");

CREATE TABLE "AiAssistantQueryAudit" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "assistantProfileId" TEXT NOT NULL, "mode" TEXT NOT NULL, "questionHash" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL, "providerModelReference" TEXT, "safetyDecision" TEXT NOT NULL,
  "refusalReasonCode" TEXT, "toolKeysJson" TEXT NOT NULL DEFAULT '[]',
  "toolCallCount" INTEGER NOT NULL DEFAULT 0, "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "citationCount" INTEGER NOT NULL DEFAULT 0, "retrievedCharacterCount" INTEGER NOT NULL DEFAULT 0,
  "redactionCount" INTEGER NOT NULL DEFAULT 0, "latencyMs" INTEGER NOT NULL, "answerHash" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" DATETIME
);
CREATE UNIQUE INDEX "AiAssistantQueryAudit_requestId_key" ON "AiAssistantQueryAudit"("requestId");
CREATE INDEX "AiAssistantQueryAudit_userId_createdAt_idx" ON "AiAssistantQueryAudit"("userId","createdAt");
CREATE INDEX "AiAssistantQueryAudit_safetyDecision_createdAt_idx" ON "AiAssistantQueryAudit"("safetyDecision","createdAt");
CREATE INDEX "AiAssistantQueryAudit_assistantProfileId_createdAt_idx" ON "AiAssistantQueryAudit"("assistantProfileId","createdAt");

CREATE TABLE "AiAssistantSafetyEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "queryAuditId" TEXT, "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL, "safeReason" TEXT NOT NULL, "safeMetadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AiAssistantSafetyEvent_queryAuditId_createdAt_idx" ON "AiAssistantSafetyEvent"("queryAuditId","createdAt");
CREATE INDEX "AiAssistantSafetyEvent_eventType_createdAt_idx" ON "AiAssistantSafetyEvent"("eventType","createdAt");

CREATE TABLE "AiAssistantEvaluationCase" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseCode" TEXT NOT NULL, "category" TEXT NOT NULL,
  "question" TEXT NOT NULL, "expectedDecision" TEXT NOT NULL,
  "requiredSourceKeysJson" TEXT NOT NULL DEFAULT '[]', "prohibitedTermsJson" TEXT NOT NULL DEFAULT '[]',
  "expectedAnswerContainsJson" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AiAssistantEvaluationCase_caseCode_key" ON "AiAssistantEvaluationCase"("caseCode");
CREATE INDEX "AiAssistantEvaluationCase_category_status_idx" ON "AiAssistantEvaluationCase"("category","status");

CREATE TABLE "AiAssistantEvaluationRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "runNumber" TEXT NOT NULL, "profileId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL, "completedAt" DATETIME, "totalCases" INTEGER NOT NULL DEFAULT 0,
  "passedCases" INTEGER NOT NULL DEFAULT 0, "failedCases" INTEGER NOT NULL DEFAULT 0,
  "blockedCases" INTEGER NOT NULL DEFAULT 0, "resultSummaryJson" TEXT NOT NULL DEFAULT '{}',
  "createdByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AiAssistantEvaluationRun_runNumber_key" ON "AiAssistantEvaluationRun"("runNumber");
CREATE INDEX "AiAssistantEvaluationRun_profileId_createdAt_idx" ON "AiAssistantEvaluationRun"("profileId","createdAt");
