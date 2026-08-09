-- OBS-1A: provider-neutral, privacy-safe technical operations records.
-- No business, account, provider or deployment data is created.

CREATE TABLE "OperationalCheckDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checkKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "checkType" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "protectedCritical" BOOLEAN NOT NULL DEFAULT false,
  "severityOnFailure" TEXT NOT NULL,
  "descriptionSafe" TEXT NOT NULL,
  "runbookPath" TEXT NOT NULL,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "OperationalCheckDefinition_checkKey_key" ON "OperationalCheckDefinition"("checkKey");
CREATE INDEX "OperationalCheckDefinition_domain_enabled_idx" ON "OperationalCheckDefinition"("domain", "enabled");
CREATE INDEX "OperationalCheckDefinition_checkType_enabled_idx" ON "OperationalCheckDefinition"("checkType", "enabled");

CREATE TABLE "OperationalCheckRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runKey" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "summarySafe" TEXT NOT NULL,
  "evidenceSummaryJson" TEXT,
  "errorFingerprint" TEXT,
  "durationMs" INTEGER,
  "actorUserId" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalCheckRun_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "OperationalCheckDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperationalCheckRun_runKey_key" ON "OperationalCheckRun"("runKey");
CREATE INDEX "OperationalCheckRun_definitionId_startedAt_idx" ON "OperationalCheckRun"("definitionId", "startedAt");
CREATE INDEX "OperationalCheckRun_status_startedAt_idx" ON "OperationalCheckRun"("status", "startedAt");
CREATE INDEX "OperationalCheckRun_expiresAt_idx" ON "OperationalCheckRun"("expiresAt");

CREATE TABLE "OperationalMetricSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "definitionId" TEXT,
  "domain" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "metricValue" REAL NOT NULL,
  "unit" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "bucketStart" DATETIME NOT NULL,
  "metadataSafeJson" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalMetricSnapshot_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "OperationalCheckDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperationalMetricSnapshot_metricKey_bucketStart_key" ON "OperationalMetricSnapshot"("metricKey", "bucketStart");
CREATE INDEX "OperationalMetricSnapshot_domain_bucketStart_idx" ON "OperationalMetricSnapshot"("domain", "bucketStart");
CREATE INDEX "OperationalMetricSnapshot_expiresAt_idx" ON "OperationalMetricSnapshot"("expiresAt");

CREATE TABLE "OperationalAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "checkKey" TEXT,
  "domain" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "titleSafe" TEXT NOT NULL,
  "evidenceSummarySafe" TEXT NOT NULL,
  "runbookPath" TEXT NOT NULL,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "acknowledgedByUserId" TEXT,
  "acknowledgedAt" DATETIME,
  "silencedByUserId" TEXT,
  "silencedAt" DATETIME,
  "silencedUntil" DATETIME,
  "silenceReasonSafe" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" DATETIME,
  "resolutionSummarySafe" TEXT,
  "closedByUserId" TEXT,
  "closedAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "OperationalAlert_publicKey_key" ON "OperationalAlert"("publicKey");
CREATE UNIQUE INDEX "OperationalAlert_fingerprint_key" ON "OperationalAlert"("fingerprint");
CREATE INDEX "OperationalAlert_status_severity_lastSeenAt_idx" ON "OperationalAlert"("status", "severity", "lastSeenAt");
CREATE INDEX "OperationalAlert_domain_status_idx" ON "OperationalAlert"("domain", "status");
CREATE INDEX "OperationalAlert_silencedUntil_idx" ON "OperationalAlert"("silencedUntil");

CREATE TABLE "OperationalAlertEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alertId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "notesSafe" TEXT,
  "actorUserId" TEXT,
  "occurrence" INTEGER NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalAlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "OperationalAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OperationalAlertEvent_alertId_occurredAt_idx" ON "OperationalAlertEvent"("alertId", "occurredAt");
CREATE INDEX "OperationalAlertEvent_eventType_occurredAt_idx" ON "OperationalAlertEvent"("eventType", "occurredAt");

CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "incidentNumber" TEXT NOT NULL,
  "alertId" TEXT,
  "domain" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "titleSafe" TEXT NOT NULL,
  "summarySafe" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "runbookPath" TEXT NOT NULL,
  "mitigationSafe" TEXT,
  "resolutionSummarySafe" TEXT,
  "postIncidentSummarySafe" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" DATETIME,
  "closedAt" DATETIME,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OperationalIncident_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "OperationalAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperationalIncident_publicKey_key" ON "OperationalIncident"("publicKey");
CREATE UNIQUE INDEX "OperationalIncident_incidentNumber_key" ON "OperationalIncident"("incidentNumber");
CREATE INDEX "OperationalIncident_status_severity_createdAt_idx" ON "OperationalIncident"("status", "severity", "createdAt");
CREATE INDEX "OperationalIncident_domain_status_idx" ON "OperationalIncident"("domain", "status");
CREATE INDEX "OperationalIncident_alertId_idx" ON "OperationalIncident"("alertId");

CREATE TABLE "OperationalIncidentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "notesSafe" TEXT,
  "actorUserId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalIncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OperationalIncidentEvent_incidentId_occurredAt_idx" ON "OperationalIncidentEvent"("incidentId", "occurredAt");
CREATE INDEX "OperationalIncidentEvent_eventType_occurredAt_idx" ON "OperationalIncidentEvent"("eventType", "occurredAt");

CREATE TABLE "MaintenanceWindow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "checkKeysJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "reasonSafe" TEXT NOT NULL,
  "expectedImpactSafe" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "plannedStartAt" DATETIME NOT NULL,
  "plannedEndAt" DATETIME NOT NULL,
  "actualStartAt" DATETIME,
  "actualEndAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "MaintenanceWindow_publicKey_key" ON "MaintenanceWindow"("publicKey");
CREATE INDEX "MaintenanceWindow_status_plannedStartAt_plannedEndAt_idx" ON "MaintenanceWindow"("status", "plannedStartAt", "plannedEndAt");
CREATE INDEX "MaintenanceWindow_domain_status_idx" ON "MaintenanceWindow"("domain", "status");

CREATE TABLE "MaintenanceWindowEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "maintenanceWindowId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "notesSafe" TEXT,
  "actorUserId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceWindowEvent_maintenanceWindowId_fkey" FOREIGN KEY ("maintenanceWindowId") REFERENCES "MaintenanceWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MaintenanceWindowEvent_maintenanceWindowId_occurredAt_idx" ON "MaintenanceWindowEvent"("maintenanceWindowId", "occurredAt");

CREATE TABLE "ReleaseManifest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseVersion" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "gitCommit" TEXT NOT NULL,
  "buildId" TEXT NOT NULL,
  "migrationVersion" TEXT NOT NULL,
  "backupVersion" INTEGER NOT NULL,
  "pwaBuildId" TEXT NOT NULL,
  "applicationSchemaId" TEXT NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ReleaseManifest_releaseVersion_key" ON "ReleaseManifest"("releaseVersion");
CREATE INDEX "ReleaseManifest_environment_isCurrent_idx" ON "ReleaseManifest"("environment", "isCurrent");
CREATE INDEX "ReleaseManifest_createdAt_idx" ON "ReleaseManifest"("createdAt");

CREATE TABLE "ClientVersionPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "environment" TEXT NOT NULL,
  "currentVersion" TEXT NOT NULL,
  "minimumSupportedVersion" TEXT NOT NULL,
  "updateAvailableVersion" TEXT,
  "updateMessageSafe" TEXT,
  "enforcementMode" TEXT NOT NULL DEFAULT 'ADVISORY',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ClientVersionPolicy_environment_key" ON "ClientVersionPolicy"("environment");
CREATE INDEX "ClientVersionPolicy_enforcementMode_updatedAt_idx" ON "ClientVersionPolicy"("enforcementMode", "updatedAt");

CREATE TABLE "BackgroundJobRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "component" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "safeErrorFingerprint" TEXT,
  "summarySafe" TEXT NOT NULL,
  "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "nextAttemptAt" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BackgroundJobRun_publicKey_key" ON "BackgroundJobRun"("publicKey");
CREATE UNIQUE INDEX "BackgroundJobRun_idempotencyKey_key" ON "BackgroundJobRun"("idempotencyKey");
CREATE INDEX "BackgroundJobRun_jobType_status_queuedAt_idx" ON "BackgroundJobRun"("jobType", "status", "queuedAt");
CREATE INDEX "BackgroundJobRun_status_nextAttemptAt_idx" ON "BackgroundJobRun"("status", "nextAttemptAt");
CREATE INDEX "BackgroundJobRun_expiresAt_idx" ON "BackgroundJobRun"("expiresAt");

-- Seed stable definitions only. Runs, alerts, incidents and metrics start empty.
INSERT INTO "OperationalCheckDefinition" ("id","checkKey","name","domain","checkType","cadence","enabled","protectedCritical","severityOnFailure","descriptionSafe","runbookPath","retentionDays","updatedAt") VALUES
('obs1a-core-process','core.process','Application process','CORE_APPLICATION_HEALTH','LIGHTWEIGHT','FREQUENT',true,false,'CRITICAL','Confirms the application process can answer a minimal local check.','/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md',90,CURRENT_TIMESTAMP),
('obs1a-db-reachable','database.reachable','Operational database reachable','DATABASE_HEALTH','LIGHTWEIGHT','FREQUENT',true,true,'CRITICAL','Confirms the configured operational database responds without exposing its path.','/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md',90,CURRENT_TIMESTAMP),
('obs1a-db-integrity','database.integrity','SQLite integrity','DATABASE_HEALTH','DEEP','MANUAL_OR_SCHEDULED',true,true,'CRITICAL','Runs governed SQLite integrity and foreign-key checks.','/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md',365,CURRENT_TIMESTAMP),
('obs1a-migration','migration.status','Migration status','MIGRATION_HEALTH','LIGHTWEIGHT','FREQUENT',true,true,'CRITICAL','Compares applied and repository migration state.','/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md',365,CURRENT_TIMESTAMP),
('obs1a-backup','backup.freshness','Backup freshness','DATA_PROTECTION_HEALTH','LIGHTWEIGHT','HOURLY',true,false,'HIGH','Separates backup availability from restore-rehearsal proof.','/docs/runbooks/OBS_BACKUP_RESTORE_RUNBOOK.md',365,CURRENT_TIMESTAMP),
('obs1a-storage','storage.capacity','Storage capacity','STORAGE_CAPACITY_HEALTH','LIGHTWEIGHT','HOURLY',true,false,'HIGH','Measures approved storage roots with configured thresholds.','/docs/runbooks/OBS_LOW_STORAGE_RUNBOOK.md',90,CURRENT_TIMESTAMP),
('obs1a-security','security.auth','Authentication and privileged-account health','SECURITY_AND_AUTH_HEALTH','LIGHTWEIGHT','HOURLY',true,true,'CRITICAL','Provides aggregate authentication and privileged-account safeguards.','/docs/runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md',365,CURRENT_TIMESTAMP),
('obs1a-jobs','jobs.outboxes','Background work and outboxes','BACKGROUND_WORK_HEALTH','LIGHTWEIGHT','FREQUENT',true,false,'HIGH','Aggregates queue, retry and failure state without private payloads.','/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md',90,CURRENT_TIMESTAMP),
('obs1a-documents','documents.processing','Document processing','DOCUMENT_PROCESSING_HEALTH','LIGHTWEIGHT','HOURLY',true,false,'HIGH','Aggregates document-processing availability and failures.','/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md',90,CURRENT_TIMESTAMP),
('obs1a-release','release.client','Release and client versions','RELEASE_AND_CLIENT_VERSION_HEALTH','LIGHTWEIGHT','HOURLY',true,false,'HIGH','Compares server, migration, backup, PWA and client policy versions.','/docs/OBS_CLIENT_RELEASE_VERSION_SPECIFICATION.md',365,CURRENT_TIMESTAMP),
('obs1a-providers','providers.configuration','Provider configuration','PROVIDER_CONFIGURATION_HEALTH','LIGHTWEIGHT','HOURLY',true,false,'WARNING','Reports provider state without activating providers or exposing secrets.','/docs/OBS_PROVIDER_STATUS_POLICY.md',90,CURRENT_TIMESTAMP),
('obs1a-business','business.integrity','Business integrity','BUSINESS_INTEGRITY_HEALTH','DEEP','MANUAL_OR_SCHEDULED',true,false,'HIGH','Runs count-only invariant checks and never repairs data automatically.','/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md',365,CURRENT_TIMESTAMP),
('obs1a-deployment','deployment.readiness','Deployment readiness','DEPLOYMENT_READINESS','LIGHTWEIGHT','HOURLY',true,false,'HIGH','Keeps deployment gates separate from core application health.','/docs/OBSERVABILITY_OPERATIONS_ARCHITECTURE.md',90,CURRENT_TIMESTAMP);

-- Immutable lifecycle evidence and no hard-delete history.
CREATE TRIGGER "operational_alert_event_no_update" BEFORE UPDATE ON "OperationalAlertEvent" BEGIN SELECT RAISE(ABORT, 'Operational alert history is append-only'); END;
CREATE TRIGGER "operational_alert_event_no_delete" BEFORE DELETE ON "OperationalAlertEvent" BEGIN SELECT RAISE(ABORT, 'Operational alert history cannot be deleted'); END;
CREATE TRIGGER "operational_incident_event_no_update" BEFORE UPDATE ON "OperationalIncidentEvent" BEGIN SELECT RAISE(ABORT, 'Operational incident history is append-only'); END;
CREATE TRIGGER "operational_incident_event_no_delete" BEFORE DELETE ON "OperationalIncidentEvent" BEGIN SELECT RAISE(ABORT, 'Operational incident history cannot be deleted'); END;
CREATE TRIGGER "maintenance_window_event_no_update" BEFORE UPDATE ON "MaintenanceWindowEvent" BEGIN SELECT RAISE(ABORT, 'Maintenance history is append-only'); END;
CREATE TRIGGER "maintenance_window_event_no_delete" BEFORE DELETE ON "MaintenanceWindowEvent" BEGIN SELECT RAISE(ABORT, 'Maintenance history cannot be deleted'); END;
CREATE TRIGGER "operational_alert_no_delete" BEFORE DELETE ON "OperationalAlert" BEGIN SELECT RAISE(ABORT, 'Operational alerts cannot be hard-deleted'); END;
CREATE TRIGGER "operational_incident_no_delete" BEFORE DELETE ON "OperationalIncident" BEGIN SELECT RAISE(ABORT, 'Operational incidents cannot be hard-deleted'); END;
CREATE TRIGGER "maintenance_window_no_delete" BEFORE DELETE ON "MaintenanceWindow" BEGIN SELECT RAISE(ABORT, 'Maintenance windows cannot be hard-deleted'); END;
