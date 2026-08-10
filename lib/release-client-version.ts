import type { ClientUpdateState, UpdateSeverity } from "@/lib/release-operations-types";

const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export type PublicClientVersionContract = {
  contractVersion: 1;
  releaseId: string;
  clientBuildId: string;
  minimumSupportedClientVersion: string;
  updateSeverity: UpdateSeverity;
  releaseDate: string;
  maintenanceState: "NONE" | "PLANNED" | "ACTIVE" | "OVERDUE";
};

function parts(value: string) {
  return value.split(/[^0-9]+/).filter(Boolean).map((row) => Number(row));
}

export function compareClientVersions(left: string, right: string) {
  const a = parts(left), b = parts(right);
  if (!a.length || !b.length) return null;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function evaluateClientUpdate(input: { clientBuildId?: string | null; serverBuildId: string; minimumSupportedClientVersion: string; severity: UpdateSeverity }): ClientUpdateState {
  const client = input.clientBuildId?.trim();
  if (!client || !SAFE_VERSION.test(client)) return "UNKNOWN";
  const minimum = compareClientVersions(client, input.minimumSupportedClientVersion);
  if (minimum === null) return client === input.serverBuildId ? "CURRENT" : "UNKNOWN";
  if (minimum < 0) return input.severity === "CRITICAL" ? "INCOMPATIBLE" : "UPDATE_REQUIRED";
  if (client === input.serverBuildId) return "CURRENT";
  if (input.severity === "REQUIRED" || input.severity === "CRITICAL") return "UPDATE_REQUIRED";
  if (input.severity === "RECOMMENDED") return "UPDATE_RECOMMENDED";
  return "UPDATE_AVAILABLE";
}

export function publicClientVersionContract(environment: NodeJS.ProcessEnv, maintenanceState: PublicClientVersionContract["maintenanceState"] = "NONE"): PublicClientVersionContract {
  const releaseId = environment.NALANDA_RELEASE_ID?.trim() || "";
  const clientBuildId = environment.NEXT_PUBLIC_PWA_BUILD_VERSION?.trim() || "";
  const minimum = environment.NALANDA_MINIMUM_WEB_CLIENT?.trim() || "";
  const severity = environment.NALANDA_CLIENT_UPDATE_SEVERITY?.trim().toUpperCase() || "";
  const releaseDate = environment.NALANDA_RELEASE_DATE?.trim() || "";
  if (!releaseId || !clientBuildId || !minimum || !severity || !releaseDate) throw new Error("PUBLIC_CLIENT_VERSION_METADATA_MISSING");
  if (![releaseId, clientBuildId, minimum].every((value) => SAFE_VERSION.test(value))) throw new Error("PUBLIC_CLIENT_VERSION_METADATA_INVALID");
  if (!["NONE", "AVAILABLE", "RECOMMENDED", "REQUIRED", "CRITICAL"].includes(severity)) throw new Error("PUBLIC_CLIENT_UPDATE_SEVERITY_INVALID");
  if (!Number.isFinite(new Date(releaseDate).valueOf())) throw new Error("PUBLIC_CLIENT_RELEASE_DATE_INVALID");
  return { contractVersion: 1, releaseId, clientBuildId, minimumSupportedClientVersion: minimum, updateSeverity: severity as UpdateSeverity, releaseDate: new Date(releaseDate).toISOString(), maintenanceState };
}

export function publicClientVersionHeaders() {
  return { "Cache-Control": "no-store, max-age=0", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
}
