import { AI_AGGREGATE_SOURCE_KEYS, AI_DOCUMENT_SOURCE_KEYS } from "@/lib/ai-assistant-registry";
import { ROLES } from "@/lib/permissions";

type Row = Record<string, unknown>;
const MAX_ROWS = 100_000;
const PROFILE_KEYS = new Set(["id","profileCode","name","providerKind","status","liveUseEnabled","allowedModesJson","maximumQuestionLength","maximumContextCharacters","maximumToolCalls","maximumRowsPerTool","requestTimeoutMs","minimumAggregateGroupSize","contentLoggingMode","auditRetentionDays","providerModelReference","lastHealthCheckAt","lastHealthCheckStatus","lastHealthCheckMessage","activatedByUserId","pausedByUserId","createdAt","updatedAt"]);
const POLICY_KEYS = new Set(["id","policyCode","sourceType","sourceKey","displayName","description","allowedRolesJson","allowedModesJson","enabled","minimumGroupSize","maximumRows","freshnessWarningDays","prohibitedFieldKeysJson","citationLabel","createdByUserId","updatedByUserId","createdAt","updatedAt"]);
const AUDIT_KEYS = new Set(["id","requestId","userId","assistantProfileId","mode","questionHash","providerKind","providerModelReference","safetyDecision","refusalReasonCode","toolKeysJson","toolCallCount","sourceCount","citationCount","retrievedCharacterCount","redactionCount","latencyMs","answerHash","createdAt","expiresAt"]);
const EVENT_KEYS = new Set(["id","queryAuditId","eventType","severity","safeReason","safeMetadataJson","createdAt"]);
const CASE_KEYS = new Set(["id","caseCode","category","question","expectedDecision","requiredSourceKeysJson","prohibitedTermsJson","expectedAnswerContainsJson","status","createdAt","updatedAt"]);
const RUN_KEYS = new Set(["id","runNumber","profileId","startedAt","completedAt","totalCases","passedCases","failedCases","blockedCases","resultSummaryJson","createdByUserId","createdAt"]);
const CREDENTIAL_FIELDS = /(?:password|api.?key|access.?token|credential|providerEndpoint|databaseUrl|fullQuestion|fullAnswer|retrievedBody|providerPayload)/i;
const REQUIRED_PROHIBITED_FIELDS = ["passwordHash", "phone1", "primaryMobile", "email", "address", "marksObtained", "teacherRank"];

export function validateAiAssistantBackupRows(root: Row, userIds: Set<string>) {
  const aiAssistantProfiles = rows(root.aiAssistantProfiles, "aiAssistantProfiles", PROFILE_KEYS);
  const aiAssistantSourcePolicies = rows(root.aiAssistantSourcePolicies, "aiAssistantSourcePolicies", POLICY_KEYS);
  const aiAssistantQueryAudits = rows(root.aiAssistantQueryAudits, "aiAssistantQueryAudits", AUDIT_KEYS);
  const aiAssistantSafetyEvents = rows(root.aiAssistantSafetyEvents, "aiAssistantSafetyEvents", EVENT_KEYS);
  const aiAssistantEvaluationCases = rows(root.aiAssistantEvaluationCases, "aiAssistantEvaluationCases", CASE_KEYS);
  const aiAssistantEvaluationRuns = rows(root.aiAssistantEvaluationRuns, "aiAssistantEvaluationRuns", RUN_KEYS);
  unique(aiAssistantProfiles, "id", "profile ID"); unique(aiAssistantProfiles, "profileCode", "profile code");
  unique(aiAssistantSourcePolicies, "id", "source-policy ID"); unique(aiAssistantSourcePolicies, "policyCode", "source-policy code");
  unique(aiAssistantSourcePolicies, (row) => `${row.sourceType}|${row.sourceKey}`, "source registry key");
  unique(aiAssistantQueryAudits, "id", "query-audit ID"); unique(aiAssistantQueryAudits, "requestId", "request ID");
  unique(aiAssistantSafetyEvents, "id", "safety-event ID");
  unique(aiAssistantEvaluationCases, "id", "evaluation-case ID"); unique(aiAssistantEvaluationCases, "caseCode", "evaluation-case code");
  unique(aiAssistantEvaluationRuns, "id", "evaluation-run ID"); unique(aiAssistantEvaluationRuns, "runNumber", "evaluation-run number");
  const profileIds = new Set(aiAssistantProfiles.map((row) => String(row.id)));
  const auditIds = new Set(aiAssistantQueryAudits.map((row) => String(row.id)));
  for (const [index, row] of aiAssistantProfiles.entries()) {
    if (!["MOCK","LOCAL_HTTP","CLOUD_API"].includes(String(row.providerKind))) throw new Error(`aiAssistantProfiles[${index}].providerKind is unsupported`);
    if (row.providerKind !== "MOCK" && (row.status !== "DISABLED" || row.liveUseEnabled !== false)) throw new Error(`aiAssistantProfiles[${index}] must preserve disabled live-provider state`);
    if (row.contentLoggingMode !== "NONE" && row.contentLoggingMode !== "HASH_ONLY") throw new Error(`aiAssistantProfiles[${index}].contentLoggingMode is unsafe`);
  }
  for (const [index, row] of aiAssistantSourcePolicies.entries()) {
    const sourceType = String(row.sourceType);
    const sourceKey = String(row.sourceKey);
    const expectedMode = sourceType === "DOCUMENT"
      ? "DOCUMENTATION"
      : sourceType === "AGGREGATE_TOOL"
        ? "AGGREGATE_OPERATIONS"
        : null;
    const registered = sourceType === "DOCUMENT"
      ? (AI_DOCUMENT_SOURCE_KEYS as readonly string[]).includes(sourceKey)
      : sourceType === "AGGREGATE_TOOL" && (AI_AGGREGATE_SOURCE_KEYS as readonly string[]).includes(sourceKey);
    if (!expectedMode || !registered) throw new Error(`aiAssistantSourcePolicies[${index}] references an unregistered source`);
    const roles = stringArray(row.allowedRolesJson, `aiAssistantSourcePolicies[${index}].allowedRolesJson`);
    const modes = stringArray(row.allowedModesJson, `aiAssistantSourcePolicies[${index}].allowedModesJson`);
    const prohibited = stringArray(row.prohibitedFieldKeysJson, `aiAssistantSourcePolicies[${index}].prohibitedFieldKeysJson`);
    if (!roles.length || roles.some((role) => !(ROLES as readonly string[]).includes(role))) throw new Error(`aiAssistantSourcePolicies[${index}] contains an unsafe role policy`);
    if (modes.length !== 1 || modes[0] !== expectedMode) throw new Error(`aiAssistantSourcePolicies[${index}] contains an unsafe mode policy`);
    if (REQUIRED_PROHIBITED_FIELDS.some((field) => !prohibited.includes(field))) throw new Error(`aiAssistantSourcePolicies[${index}] weakens prohibited-field protections`);
    if (sourceType === "AGGREGATE_TOOL") {
      const minimumGroupSize = Number(row.minimumGroupSize);
      const maximumRows = Number(row.maximumRows);
      if (!Number.isInteger(minimumGroupSize) || minimumGroupSize < 5 || !Number.isInteger(maximumRows) || maximumRows < 1 || maximumRows > 250) {
        throw new Error(`aiAssistantSourcePolicies[${index}] contains unsafe aggregate limits`);
      }
    }
  }
  for (const [index, row] of aiAssistantQueryAudits.entries()) {
    if (!profileIds.has(String(row.assistantProfileId))) throw new Error(`aiAssistantQueryAudits[${index}].assistantProfileId is invalid`);
    if (!userIds.has(String(row.userId))) throw new Error(`aiAssistantQueryAudits[${index}].userId is unrelated`);
    if (!/^[a-f0-9]{64}$/i.test(String(row.questionHash))) throw new Error(`aiAssistantQueryAudits[${index}].questionHash is invalid`);
    if (row.answerHash != null && !/^[a-f0-9]{64}$/i.test(String(row.answerHash))) throw new Error(`aiAssistantQueryAudits[${index}].answerHash is invalid`);
  }
  for (const [index, row] of aiAssistantSafetyEvents.entries()) if (row.queryAuditId && !auditIds.has(String(row.queryAuditId))) throw new Error(`aiAssistantSafetyEvents[${index}].queryAuditId is invalid`);
  for (const [index, row] of aiAssistantEvaluationRuns.entries()) if (!profileIds.has(String(row.profileId))) throw new Error(`aiAssistantEvaluationRuns[${index}].profileId is invalid`);
  return { aiAssistantProfiles, aiAssistantSourcePolicies, aiAssistantQueryAudits, aiAssistantSafetyEvents, aiAssistantEvaluationCases, aiAssistantEvaluationRuns };
}

function rows(value: unknown, label: string, keys: Set<string>) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw new Error(`${label} must be a bounded array`);
  return value.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}[${index}] must be an object`);
    const row = value as Row;
    const unknown = Object.keys(row).find((key) => !keys.has(key) || CREDENTIAL_FIELDS.test(key));
    if (unknown) throw new Error(`${label}[${index}] contains unsafe or unknown field: ${unknown}`);
    return row;
  });
}

function unique(rows: Row[], field: string | ((row: Row) => string), label: string) {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const value = typeof field === "function" ? field(row) : String(row[field] ?? "");
    if (!value || seen.has(value.toLowerCase())) throw new Error(`AI assistant backup duplicates ${label} at row ${index + 1}`);
    seen.add(value.toLowerCase());
  });
}

function stringArray(value: unknown, label: string) {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error();
    return parsed as string[];
  } catch {
    throw new Error(`${label} must be a JSON string array`);
  }
}
