export const OPERATIONAL_DOMAINS = [
  "CORE_APPLICATION_HEALTH",
  "DATABASE_HEALTH",
  "MIGRATION_HEALTH",
  "DATA_PROTECTION_HEALTH",
  "STORAGE_CAPACITY_HEALTH",
  "SECURITY_AND_AUTH_HEALTH",
  "BACKGROUND_WORK_HEALTH",
  "NOTIFICATION_DELIVERY_HEALTH",
  "DOCUMENT_PROCESSING_HEALTH",
  "RELEASE_AND_CLIENT_VERSION_HEALTH",
  "PROVIDER_CONFIGURATION_HEALTH",
  "BUSINESS_INTEGRITY_HEALTH",
  "DEPLOYMENT_READINESS"
] as const;

export type OperationalDomain = (typeof OPERATIONAL_DOMAINS)[number];
export const OPERATIONAL_STATUSES = ["HEALTHY", "DEGRADED", "WARNING", "CRITICAL", "UNKNOWN", "NOT_CONFIGURED", "MAINTENANCE"] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];
export const ALERT_SEVERITIES = ["INFO", "WARNING", "HIGH", "CRITICAL"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "SILENCED", "RESOLVED", "CLOSED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export const PROVIDER_STATES = ["NOT_CONFIGURED", "DISABLED", "TEST", "LIVE", "DEGRADED", "FAILED"] as const;
export type ProviderState = (typeof PROVIDER_STATES)[number];
export const CLIENT_VERSION_STATES = ["CURRENT", "UPDATE_AVAILABLE", "UPDATE_REQUIRED", "UNKNOWN"] as const;
export type ClientVersionState = (typeof CLIENT_VERSION_STATES)[number];

export type DomainHealthCard = {
  domain: OperationalDomain;
  label: string;
  status: OperationalStatus;
  lastCheckedAt: string | null;
  explanation: string;
  action: string;
  runbookPath: string;
  metrics: Array<{ label: string; value: string | number; status?: OperationalStatus }>;
};

export type ProviderHealthItem = {
  category: string;
  environment: string;
  state: ProviderState;
  enabled: boolean;
  configurationComplete: boolean;
  lastHealthAt: string | null;
  lastSuccessAt: string | null;
  failureCount: number;
  explanation: string;
};

export type TechnicalOperationsDashboard = {
  generatedAt: string;
  summaryOnly: boolean;
  conclusions: {
    coreApplication: OperationalStatus;
    operationalReadiness: OperationalStatus;
    deploymentReadiness: OperationalStatus;
    optionalProviders: OperationalStatus;
    overall: OperationalStatus;
    explanation: string;
  };
  domains: DomainHealthCard[];
  adoption: {
    activeSessions: number;
    uniqueUsers24h: number;
    uniqueUsers7d: number;
    neverLoggedIn: number;
    disabledOrPending: number;
    roleGroups: Array<{ label: string; activeSessions: number; users7d: number }>;
  };
  providers: ProviderHealthItem[];
  release: {
    serverVersion: string;
    environment: string;
    gitCommit: string;
    buildId: string;
    migrationVersion: string;
    migrationCount: number;
    backupVersion: number;
    pwaBuildId: string;
    applicationSchemaVersion: string;
    clientState: ClientVersionState;
    staleClientCount: number;
    policyVersion: number | null;
    policyCurrentVersion: string | null;
    minimumSupportedVersion: string | null;
    updateAvailableVersion: string | null;
  };
  alerts: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>;
  maintenanceWindows: Array<Record<string, unknown>>;
};

const STATUS_WEIGHT: Record<OperationalStatus, number> = {
  HEALTHY: 0,
  NOT_CONFIGURED: 0,
  MAINTENANCE: 1,
  UNKNOWN: 2,
  DEGRADED: 3,
  WARNING: 4,
  CRITICAL: 5
};

export function worstOperationalStatus(statuses: OperationalStatus[], fallback: OperationalStatus = "UNKNOWN") {
  if (!statuses.length) return fallback;
  return statuses.reduce((worst, current) => STATUS_WEIGHT[current] > STATUS_WEIGHT[worst] ? current : worst);
}

export function operationalDomainLabel(domain: OperationalDomain) {
  return ({
    CORE_APPLICATION_HEALTH: "Core Application Health",
    DATABASE_HEALTH: "Database Health",
    MIGRATION_HEALTH: "Database and Migration",
    DATA_PROTECTION_HEALTH: "Data Protection",
    STORAGE_CAPACITY_HEALTH: "Storage Capacity",
    SECURITY_AND_AUTH_HEALTH: "Security and Sessions",
    BACKGROUND_WORK_HEALTH: "Background Work",
    NOTIFICATION_DELIVERY_HEALTH: "Jobs and Notifications",
    DOCUMENT_PROCESSING_HEALTH: "Document Processing",
    RELEASE_AND_CLIENT_VERSION_HEALTH: "Release and Client Versions",
    PROVIDER_CONFIGURATION_HEALTH: "Provider Configuration",
    BUSINESS_INTEGRITY_HEALTH: "Business Integrity",
    DEPLOYMENT_READINESS: "Deployment Readiness"
  } as const)[domain];
}
