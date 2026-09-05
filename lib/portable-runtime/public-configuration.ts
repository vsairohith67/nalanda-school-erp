// Safe for server-to-client serialization. No spreading of process.env or secrets.
export function portablePublicConfiguration(environment: Record<string, string | undefined>) {
  const profile = environment.PORTABLE_PROFILE ?? "local-single-node";
  if (profile !== "local-single-node" && profile !== "generic-vps") throw new Error("PUBLIC_RUNTIME_PROFILE_INVALID");
  return Object.freeze({ schemaVersion: 1 as const, profile, telemetry: "PROVIDER_DISABLED" as const,
    externalTelemetry: false as const, deploymentCertification: "NOT_PERFORMED" as const });
}

// Technical Operations must remain available when an optional setting is invalid.
export function portableDiagnosticsConfiguration(environment: Record<string, string | undefined>) {
  try { return portablePublicConfiguration(environment); }
  catch { return Object.freeze({ schemaVersion: 1 as const, profile: "unknown" as const, telemetry: "DEGRADED" as const,
    externalTelemetry: false as const, deploymentCertification: "NOT_PERFORMED" as const }); }
}

export const PORTABLE_CONFIGURATION_CONTRACT = Object.freeze({
  schemaVersion: 1, databaseMajor: 17, backupVersion: 45,
  build: ["SOURCE_COMMIT", "SOURCE_DATE_EPOCH", "NEXT_PUBLIC_PWA_BUILD_VERSION", "NALANDA_STANDALONE_BUILD"],
  serverRuntime: ["APP_ORIGIN", "DATABASE_URL_FILE", "DIRECT_URL_FILE", "VALKEY_URL_FILE", "S3_ENDPOINT", "S3_PRIVATE_BUCKET", "AUTH_SECRET_FILE", "CLOUD_BACKUP_ENCRYPTION_KEY_V1_FILE"],
  publicRuntime: ["schemaVersion", "profile", "telemetry", "externalTelemetry", "deploymentCertification"],
  forbiddenPublicPrefixes: ["NEXT_PUBLIC_SENTRY", "NEXT_PUBLIC_POSTHOG", "NEXT_PUBLIC_OTEL", "NEXT_PUBLIC_PROVIDER"]
});
