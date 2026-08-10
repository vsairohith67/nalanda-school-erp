import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256Bytes } from "@/lib/release-manifest";
import { releaseGateTemplate, type ReleaseAuditEvent, type ReleaseCandidateState, type ReleaseEnvironment, type ReleasePhase } from "@/lib/release-operations-types";

export type ReleaseLock = {
  contractVersion: 1;
  owner: string;
  session: string;
  environment: ReleaseEnvironment;
  releaseId: string;
  acquiredAt: string;
  expiresAt: string;
};

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._@-]{2,119}$/;
const PRIVATE_TEXT = /(?:password|secret|token|cookie|[A-Za-z]:\\|\/home\/|database.*hash|backup.*path)/i;

export function releaseStateRoot(workspaceRoot: string, configured?: string) {
  const root = path.resolve(configured?.trim() || path.join(workspaceRoot, ".codex", "release-ops"));
  const relative = path.relative(path.resolve(workspaceRoot), root);
  if (configured && !path.isAbsolute(configured)) throw new Error("RELEASE_STATE_ROOT_NOT_ABSOLUTE");
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) {
    const parent = path.dirname(root);
    if (parent === root) throw new Error("RELEASE_STATE_ROOT_TOO_BROAD");
  }
  return root;
}

function safeToken(value: string, label: string) {
  const result = value.trim();
  if (!SAFE_TOKEN.test(result)) throw new Error(`RELEASE_${label}_INVALID`);
  return result;
}

function safeSummary(value: string) {
  const result = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (result.length < 3 || result.length > 500 || PRIVATE_TEXT.test(result)) throw new Error("RELEASE_AUDIT_SUMMARY_UNSAFE");
  return result;
}

function lockPath(root: string) { return path.join(root, "release.lock.json"); }
function statePath(root: string) { return path.join(root, "candidate.json"); }
function auditPath(root: string) { return path.join(root, "audit.jsonl"); }

export function readReleaseLock(root: string): ReleaseLock | null {
  const file = lockPath(root);
  if (!existsSync(file)) return null;
  const value = JSON.parse(readFileSync(file, "utf8")) as ReleaseLock;
  if (value.contractVersion !== 1 || !SAFE_TOKEN.test(value.owner) || !SAFE_TOKEN.test(value.session) || !SAFE_TOKEN.test(value.releaseId)) throw new Error("RELEASE_LOCK_INVALID");
  return value;
}

export function acquireReleaseLock(input: { root: string; owner: string; session: string; environment: ReleaseEnvironment; releaseId: string; ttlMs?: number; recoverStale?: boolean; recoveryReason?: string }) {
  mkdirSync(input.root, { recursive: true });
  const existing = readReleaseLock(input.root);
  if (existing) {
    const stale = new Date(existing.expiresAt).valueOf() <= Date.now();
    if (!stale) throw new Error("RELEASE_LOCK_HELD");
    if (!input.recoverStale || !input.recoveryReason) throw new Error("RELEASE_STALE_LOCK_REQUIRES_GOVERNED_RECOVERY");
    appendReleaseAudit(input.root, { releaseId: existing.releaseId, environment: existing.environment, phase: "inspect", eventType: "STALE_LOCK_RECOVERED", actor: input.owner, summarySafe: input.recoveryReason });
    rmSync(lockPath(input.root));
  }
  const ttlMs = Math.min(Math.max(input.ttlMs ?? 30 * 60_000, 60_000), 8 * 60 * 60_000);
  const acquiredAt = new Date();
  const lock: ReleaseLock = {
    contractVersion: 1,
    owner: safeToken(input.owner, "LOCK_OWNER"),
    session: safeToken(input.session, "LOCK_SESSION"),
    environment: input.environment,
    releaseId: safeToken(input.releaseId, "ID"),
    acquiredAt: acquiredAt.toISOString(),
    expiresAt: new Date(acquiredAt.valueOf() + ttlMs).toISOString()
  };
  const descriptor = openSync(lockPath(input.root), "wx", 0o600);
  try { writeFileSync(descriptor, `${JSON.stringify(lock, null, 2)}\n`); } finally { closeSync(descriptor); }
  appendReleaseAudit(input.root, { releaseId: lock.releaseId, environment: lock.environment, phase: "inspect", eventType: "LOCK_ACQUIRED", actor: lock.owner, summarySafe: "Exclusive local release lock acquired." });
  return lock;
}

export function releaseLock(input: { root: string; owner: string; session: string; releaseId: string }) {
  const existing = readReleaseLock(input.root);
  if (!existing || existing.owner !== input.owner || existing.session !== input.session || existing.releaseId !== input.releaseId) throw new Error("RELEASE_LOCK_OWNERSHIP_MISMATCH");
  rmSync(lockPath(input.root));
  appendReleaseAudit(input.root, { releaseId: existing.releaseId, environment: existing.environment, phase: "inspect-cleanup", eventType: "LOCK_RELEASED", actor: existing.owner, summarySafe: "Exclusive local release lock released." });
}

export function readReleaseAudit(root: string): ReleaseAuditEvent[] {
  const file = auditPath(root);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ReleaseAuditEvent);
}

export function appendReleaseAudit(root: string, input: Omit<ReleaseAuditEvent, "sequence" | "occurredAt" | "previousHash" | "eventHash">) {
  mkdirSync(root, { recursive: true });
  const events = readReleaseAudit(root);
  const previous = events.at(-1) ?? null;
  const core = {
    sequence: (previous?.sequence ?? 0) + 1,
    occurredAt: new Date().toISOString(),
    releaseId: safeToken(input.releaseId, "ID"),
    environment: input.environment,
    phase: input.phase,
    eventType: safeToken(input.eventType, "AUDIT_EVENT"),
    actor: safeToken(input.actor, "AUDIT_ACTOR"),
    summarySafe: safeSummary(input.summarySafe),
    previousHash: previous?.eventHash ?? null
  };
  const event: ReleaseAuditEvent = { ...core, eventHash: sha256Bytes(JSON.stringify(core)) };
  appendFileSync(auditPath(root), `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  return event;
}

export function verifyReleaseAudit(root: string) {
  let previousHash: string | null = null;
  const events = readReleaseAudit(root);
  for (const [index, event] of events.entries()) {
    const { eventHash, ...core } = event;
    if (event.sequence !== index + 1 || event.previousHash !== previousHash || sha256Bytes(JSON.stringify(core)) !== eventHash) throw new Error("RELEASE_AUDIT_CHAIN_INVALID");
    previousHash = eventHash;
  }
  return { valid: true, events: events.length, lastHash: previousHash };
}

export function createReleaseCandidate(input: { releaseId: string; environment: ReleaseEnvironment; expectedCurrentRelease: string; expectedTargetRelease: string; previousKnownGoodRelease: string; migrationClassification?: ReleaseCandidateState["migrationClassification"] }): ReleaseCandidateState {
  const now = new Date().toISOString();
  return {
    contractVersion: 1,
    releaseId: safeToken(input.releaseId, "ID"),
    environment: input.environment,
    status: "DRAFT",
    expectedCurrentRelease: safeToken(input.expectedCurrentRelease, "CURRENT_RELEASE"),
    expectedTargetRelease: safeToken(input.expectedTargetRelease, "TARGET_RELEASE"),
    migrationClassification: input.migrationClassification ?? "NONE",
    phase: "inspect",
    pointOfNoReturnReached: false,
    dataWriteBoundaryCrossed: false,
    previousKnownGoodRelease: safeToken(input.previousKnownGoodRelease, "PREVIOUS_RELEASE"),
    gates: releaseGateTemplate(),
    featureFlags: [],
    maintenance: { active: false, startsAt: null, endsAt: null, reasonSafe: null },
    client: { buildId: input.releaseId, minimumSupportedVersion: "0.1.0", updateSeverity: "AVAILABLE" },
    rollback: { ready: false, owner: null, deadline: null, recommendation: "Abort without change before the release switch." },
    updatedAt: now
  };
}

export function readReleaseCandidate(root: string): ReleaseCandidateState | null {
  const file = statePath(root);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as ReleaseCandidateState;
}

export function writeReleaseCandidate(root: string, state: ReleaseCandidateState) {
  mkdirSync(root, { recursive: true });
  const file = statePath(root), temp = `${file}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, file);
}

const PRE_MAINTENANCE_GATES = [
  "clean-git-tree", "expected-branch", "reviewed-commit", "git-safety", "lock-integrity",
  "typecheck", "focused-tests", "full-tests", "production-build", "route-api-inventory",
  "migration-validation", "fresh-install", "copied-database", "synthetic-staging",
  "security-scan", "release-notes", "rollback-package", "named-approver", "maintenance-window"
] as const;

function unresolvedGates(state: ReleaseCandidateState, keys: readonly string[]) {
  return keys.filter((key) => {
    const gate = state.gates.find((row) => row.key === key);
    return !gate || (gate.status !== "PASSED" && gate.status !== "WAIVED");
  });
}

export function assertReleasePhaseAllowed(state: ReleaseCandidateState, phase: ReleasePhase) {
  let required: readonly string[] = [];
  if (phase === "enter-maintenance") required = PRE_MAINTENANCE_GATES;
  if (phase === "backup") required = [...PRE_MAINTENANCE_GATES, "maintenance-window"];
  if (phase === "migrate") required = [...PRE_MAINTENANCE_GATES, "backup-created", "restore-rehearsed"];
  if (phase === "switch-release") required = [...PRE_MAINTENANCE_GATES, "backup-created", "restore-rehearsed"];
  if (phase === "complete") required = state.gates.map((gate) => gate.key);
  const missing = unresolvedGates(state, required);
  if (missing.length) throw new Error(`RELEASE_REQUIRED_GATES_INCOMPLETE:${missing.join(",")}`);
  if (["enter-maintenance", "backup", "migrate", "switch-release", "health-check", "smoke-test", "complete"].includes(phase)) {
    const rollbackDeadline = state.rollback.deadline ? new Date(state.rollback.deadline).valueOf() : Number.NaN;
    if (!state.rollback.ready || !state.rollback.owner || !Number.isFinite(rollbackDeadline) || rollbackDeadline <= Date.now()) {
      throw new Error("RELEASE_ROLLBACK_OWNER_REQUIRED");
    }
  }
  if (["backup", "migrate", "switch-release", "health-check", "smoke-test", "complete"].includes(phase) && !state.maintenance.active) {
    throw new Error("RELEASE_MAINTENANCE_REQUIRED");
  }
  const allowedPrevious: Partial<Record<ReleasePhase, ReleasePhase[]>> = {
    backup: ["enter-maintenance", "backup"],
    migrate: ["backup", "migrate"],
    "switch-release": state.migrationClassification === "NONE" ? ["backup", "switch-release"] : ["migrate", "switch-release"],
    "health-check": ["switch-release", "health-check"],
    "smoke-test": ["health-check", "smoke-test"],
    complete: ["smoke-test", "complete"]
  };
  if (allowedPrevious[phase] && !allowedPrevious[phase]!.includes(state.phase)) throw new Error("RELEASE_PHASE_SEQUENCE_INVALID");
  if (phase === "complete" && !state.pointOfNoReturnReached) throw new Error("RELEASE_SWITCH_NOT_RECORDED");
}

export function updateReleasePhase(root: string, input: { phase: ReleasePhase; actor: string; summarySafe: string }) {
  const state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  assertReleasePhaseAllowed(state, input.phase);
  state.phase = input.phase;
  if (["enter-maintenance", "backup", "migrate", "switch-release", "health-check", "smoke-test", "complete"].includes(input.phase)) state.status = "RELEASING";
  if (input.phase === "enter-maintenance") state.maintenance = { ...state.maintenance, active: true, startsAt: state.maintenance.startsAt ?? new Date().toISOString(), endsAt: null };
  if (input.phase === "migrate") state.dataWriteBoundaryCrossed = true;
  if (input.phase === "switch-release") state.pointOfNoReturnReached = true;
  if (input.phase === "complete") {
    state.status = "RELEASED";
    state.maintenance = { ...state.maintenance, active: false, endsAt: new Date().toISOString() };
  }
  if (input.phase === "rollback") state.status = "ROLLED_BACK";
  writeReleaseCandidate(root, state);
  appendReleaseAudit(root, { releaseId: state.releaseId, environment: state.environment, phase: input.phase, eventType: "PHASE_RECORDED", actor: input.actor, summarySafe: input.summarySafe });
  return state;
}

export function releaseStateFileInfo(root: string) {
  return [statePath(root), auditPath(root), lockPath(root)].filter(existsSync).map((file) => ({ name: path.basename(file), bytes: statSync(file).size }));
}

export function releaseDiskProbe(root: string, injectedAvailableBytes?: number) {
  mkdirSync(root, { recursive: true });
  const stat = statfsSync(root);
  const availableBytes = injectedAvailableBytes ?? Number(stat.bavail) * Number(stat.bsize);
  const totalBytes = Number(stat.blocks) * Number(stat.bsize);
  const status = availableBytes < 1 * 1024 ** 3 ? "CRITICAL" : availableBytes < 5 * 1024 ** 3 ? "WARNING" : "HEALTHY";
  return { status, availableBytes, totalBytes } as const;
}
