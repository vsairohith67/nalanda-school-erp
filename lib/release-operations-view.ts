import path from "node:path";
import packageJson from "../package.json";
import { releaseFeatureFlags } from "@/lib/release-feature-flags";
import { readReleaseAudit, readReleaseCandidate, releaseStateRoot } from "@/lib/release-state";

export type ReleaseOperationsView = ReturnType<typeof getReleaseOperationsView>;

export function getReleaseOperationsView(input: { workspaceRoot?: string; summaryOnly: boolean }) {
  const workspaceRoot = path.resolve(input.workspaceRoot || process.cwd());
  const root = releaseStateRoot(workspaceRoot, process.env.NALANDA_RELEASE_STATE_ROOT);
  const candidate = readReleaseCandidate(root);
  const currentRelease = process.env.NALANDA_RELEASE_ID?.trim() || process.env.NEXT_PUBLIC_PWA_BUILD_VERSION?.trim() || String(packageJson.version);
  const gates = candidate?.gates ?? [];
  const passed = gates.filter((gate) => gate.status === "PASSED").length;
  const failed = gates.filter((gate) => gate.status === "FAILED").length;
  const pending = gates.filter((gate) => gate.status === "PENDING").length;
  return {
    generatedAt: new Date().toISOString(),
    summaryOnly: input.summaryOnly,
    currentRelease,
    candidate: candidate ? {
      releaseId: candidate.releaseId,
      targetRelease: candidate.expectedTargetRelease,
      channel: candidate.environment,
      status: candidate.status,
      phase: candidate.phase,
      migrationClassification: candidate.migrationClassification,
      gateSummary: { passed, failed, pending, total: gates.length },
      backupReady: gates.find((gate) => gate.key === "backup-created")?.status === "PASSED",
      restoreReady: gates.find((gate) => gate.key === "restore-rehearsed")?.status === "PASSED",
      stagingAccepted: gates.find((gate) => gate.key === "synthetic-staging")?.status === "PASSED",
      browserReady: gates.find((gate) => gate.key === "browser-smoke")?.status === "PASSED",
      maintenance: candidate.maintenance,
      client: candidate.client,
      rollback: candidate.rollback,
      pointOfNoReturnReached: candidate.pointOfNoReturnReached,
      updatedAt: candidate.updatedAt
    } : null,
    gates: input.summaryOnly ? [] : gates,
    featureFlags: input.summaryOnly ? [] : releaseFeatureFlags().map((flag) => ({ key: flag.key, environment: flag.environment, enabled: flag.defaultState, version: flag.version, owner: flag.owner, reason: flag.reason })),
    history: input.summaryOnly ? [] : readReleaseAudit(root).slice(-30).reverse().map((event) => ({ sequence: event.sequence, occurredAt: event.occurredAt, phase: event.phase, eventType: event.eventType, actor: event.actor, summarySafe: event.summarySafe })),
    boundaries: {
      deploymentAuthorised: false,
      providersAuthorised: false,
      dnsChangeAuthorised: false,
      operationalDataInStagingAuthorised: false,
      message: "Release machinery is local/private. Public or cloud deployment requires separate provider, budget and cutover approval."
    }
  };
}
