import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { OPERATIONAL_DOMAINS, type AlertStatus, type OperationalDomain } from "@/lib/technical-operations-types";

const ALERT_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "INVESTIGATING", "SILENCED", "RESOLVED"],
  ACKNOWLEDGED: ["INVESTIGATING", "SILENCED", "RESOLVED"],
  INVESTIGATING: ["SILENCED", "RESOLVED"],
  SILENCED: ["ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"]
};
const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["INVESTIGATING", "MITIGATED", "RESOLVED"],
  INVESTIGATING: ["MITIGATED", "RESOLVED"],
  MITIGATED: ["INVESTIGATING", "RESOLVED"],
  RESOLVED: ["INVESTIGATING", "CLOSED"],
  CLOSED: []
};
const PROTECTED_CHECKS = new Set(["database.reachable", "database.integrity", "migration.status", "security.auth"]);

export class OperationalWorkflowError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "OPERATIONAL_WORKFLOW_FAILED") { super(message); }
}

export async function transitionOperationalAlert(client: PrismaClient, publicKey: string, input: Record<string, unknown>, actorUserId: string, now = new Date()) {
  const action = String(input.action ?? "").trim().toUpperCase();
  const expectedVersion = positiveVersion(input.expectedVersion);
  const current = await client.operationalAlert.findUnique({ where: { publicKey } });
  if (!current) throw new OperationalWorkflowError("Operational alert not found.", 404, "NOT_FOUND");
  if (current.version !== expectedVersion) throw stale();
  const target = action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : action === "INVESTIGATE" ? "INVESTIGATING" : action === "SILENCE" ? "SILENCED" : action === "RESOLVE" ? "RESOLVED" : action === "CLOSE" ? "CLOSED" : action === "REOPEN" ? "OPEN" : "";
  if (!target || !ALERT_TRANSITIONS[current.status as AlertStatus]?.includes(target as AlertStatus)) throw new OperationalWorkflowError("Alert action is not valid for the current state.", 409, "INVALID_TRANSITION");
  const reason = target === "SILENCED" || target === "RESOLVED" || target === "CLOSED" ? safeNote(input.reason, "Reason", 8, 500) : optionalSafeNote(input.reason, 500);
  let silencedUntil: Date | null = null;
  if (target === "SILENCED") {
    silencedUntil = boundedFutureDate(input.silencedUntil, now, 30);
    if (current.severity === "CRITICAL" || (current.checkKey && PROTECTED_CHECKS.has(current.checkKey))) throw new OperationalWorkflowError("This protected critical alert cannot be silenced.", 409, "PROTECTED_ALERT");
  }
  return client.$transaction(async (tx) => {
    const changed = await tx.operationalAlert.updateMany({ where: { id: current.id, version: expectedVersion }, data: {
      status: target,
      version: { increment: 1 },
      ...(target === "ACKNOWLEDGED" ? { acknowledgedAt: now, acknowledgedByUserId: actorUserId } : {}),
      ...(target === "SILENCED" ? { silencedAt: now, silencedByUserId: actorUserId, silencedUntil, silenceReasonSafe: reason } : {}),
      ...(target === "RESOLVED" ? { resolvedAt: now, resolvedByUserId: actorUserId, resolutionSummarySafe: reason } : {}),
      ...(target === "CLOSED" ? { closedAt: now, closedByUserId: actorUserId } : {}),
      ...(target === "OPEN" ? { acknowledgedAt: null, acknowledgedByUserId: null, silencedAt: null, silencedByUserId: null, silencedUntil: null, silenceReasonSafe: null, resolvedAt: null, resolvedByUserId: null, resolutionSummarySafe: null, closedAt: null, closedByUserId: null } : {})
    } });
    if (changed.count !== 1) throw stale();
    await tx.operationalAlertEvent.create({ data: { alertId: current.id, eventType: action, previousStatus: current.status, newStatus: target, notesSafe: reason, actorUserId, occurrence: current.occurrenceCount, occurredAt: now } });
    return tx.operationalAlert.findUniqueOrThrow({ where: { id: current.id }, include: { events: { orderBy: { occurredAt: "desc" }, take: 20 } } });
  });
}

export async function createOperationalIncident(client: PrismaClient, input: Record<string, unknown>, actorUserId: string, now = new Date()) {
  const alert = input.alertPublicKey ? await client.operationalAlert.findUnique({ where: { publicKey: String(input.alertPublicKey) } }) : null;
  if (input.alertPublicKey && !alert) throw new OperationalWorkflowError("Operational alert not found.", 404, "ALERT_NOT_FOUND");
  const domain = operationalDomain(input.domain ?? alert?.domain);
  const severity = severityValue(input.severity ?? alert?.severity);
  const titleSafe = safeNote(input.title ?? alert?.titleSafe, "Incident title", 8, 160);
  const summarySafe = safeNote(input.summary ?? alert?.evidenceSummarySafe, "Incident summary", 8, 800);
  const runbookPath = safeRunbook(input.runbookPath ?? alert?.runbookPath);
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const count = await client.operationalIncident.count({ where: { createdAt: { gte: new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`) } } });
  return client.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.create({ data: { publicKey: randomUUID(), incidentNumber: `OPS-${date}-${String(count + 1).padStart(4, "0")}`, alertId: alert?.id ?? null, domain, severity, titleSafe, summarySafe, ownerUserId: optionalActor(input.ownerUserId), runbookPath, createdByUserId: actorUserId } });
    await tx.operationalIncidentEvent.create({ data: { incidentId: incident.id, eventType: alert ? "CREATED_FROM_ALERT" : "CREATED_MANUALLY", newStatus: "OPEN", notesSafe: summarySafe, actorUserId, version: 1, occurredAt: now } });
    return incident;
  });
}

export async function transitionOperationalIncident(client: PrismaClient, publicKey: string, input: Record<string, unknown>, actorUserId: string, now = new Date()) {
  const current = await client.operationalIncident.findUnique({ where: { publicKey } });
  if (!current) throw new OperationalWorkflowError("Operational incident not found.", 404, "NOT_FOUND");
  const expectedVersion = positiveVersion(input.expectedVersion);
  if (current.version !== expectedVersion) throw stale();
  const action = String(input.action ?? "").trim().toUpperCase();
  const target = action === "INVESTIGATE" ? "INVESTIGATING" : action === "MITIGATE" ? "MITIGATED" : action === "RESOLVE" ? "RESOLVED" : action === "CLOSE" ? "CLOSED" : "";
  if (!target || !INCIDENT_TRANSITIONS[current.status]?.includes(target)) throw new OperationalWorkflowError("Incident action is not valid for the current state.", 409, "INVALID_TRANSITION");
  const note = safeNote(input.note, "Internal note", 5, 1000);
  if (target === "CLOSED" && !String(input.postIncidentSummary ?? "").trim()) throw new OperationalWorkflowError("A privacy-safe post-incident summary is required before closure.");
  const post = target === "CLOSED" ? safeNote(input.postIncidentSummary, "Post-incident summary", 8, 1200) : null;
  return client.$transaction(async (tx) => {
    const changed = await tx.operationalIncident.updateMany({ where: { id: current.id, version: expectedVersion }, data: {
      status: target, version: { increment: 1 },
      ...(input.ownerUserId !== undefined ? { ownerUserId: optionalActor(input.ownerUserId) } : {}),
      ...(target === "MITIGATED" ? { mitigationSafe: note } : {}),
      ...(target === "RESOLVED" ? { resolutionSummarySafe: note, resolvedAt: now } : {}),
      ...(target === "CLOSED" ? { postIncidentSummarySafe: post, closedAt: now } : {})
    } });
    if (changed.count !== 1) throw stale();
    await tx.operationalIncidentEvent.create({ data: { incidentId: current.id, eventType: action, previousStatus: current.status, newStatus: target, notesSafe: note, actorUserId, version: expectedVersion + 1, occurredAt: now } });
    return tx.operationalIncident.findUniqueOrThrow({ where: { id: current.id }, include: { events: { orderBy: { occurredAt: "desc" } } } });
  });
}

export async function createMaintenanceWindow(client: PrismaClient, input: Record<string, unknown>, actorUserId: string, now = new Date()) {
  const domain = operationalDomain(input.domain);
  const checkKeys = stringList(input.checkKeys, 20).filter((value) => /^[a-z0-9.-]{3,80}$/.test(value));
  if (!checkKeys.length) throw new OperationalWorkflowError("At least one exact check key is required.");
  if (checkKeys.some((key) => PROTECTED_CHECKS.has(key))) throw new OperationalWorkflowError("Protected corruption, migration or privileged-account checks cannot be suppressed.", 409, "PROTECTED_CHECK");
  const plannedStartAt = futureDate(input.plannedStartAt, now);
  const plannedEndAt = futureDate(input.plannedEndAt, now);
  if (plannedEndAt <= plannedStartAt || plannedEndAt.valueOf() - plannedStartAt.valueOf() > 14 * 24 * 60 * 60 * 1000) throw new OperationalWorkflowError("Maintenance must end after it starts and remain within 14 days.");
  const reasonSafe = safeNote(input.reason, "Maintenance reason", 8, 500);
  const expectedImpactSafe = safeNote(input.expectedImpact, "Expected service impact", 8, 500);
  return client.$transaction(async (tx) => {
    const window = await tx.maintenanceWindow.create({ data: { publicKey: randomUUID(), domain, checkKeysJson: JSON.stringify(checkKeys), reasonSafe, expectedImpactSafe, ownerUserId: optionalActor(input.ownerUserId) ?? actorUserId, plannedStartAt, plannedEndAt } });
    await tx.maintenanceWindowEvent.create({ data: { maintenanceWindowId: window.id, eventType: "PLANNED", notesSafe: reasonSafe, actorUserId, version: 1, occurredAt: now } });
    return window;
  });
}

export async function transitionMaintenanceWindow(client: PrismaClient, publicKey: string, input: Record<string, unknown>, actorUserId: string, now = new Date()) {
  const current = await client.maintenanceWindow.findUnique({ where: { publicKey } });
  if (!current) throw new OperationalWorkflowError("Maintenance window not found.", 404, "NOT_FOUND");
  const expectedVersion = positiveVersion(input.expectedVersion);
  if (current.version !== expectedVersion) throw stale();
  const action = String(input.action ?? "").trim().toUpperCase();
  const target = action === "START" && current.status === "PLANNED" ? "ACTIVE" : action === "COMPLETE" && current.status === "ACTIVE" ? "COMPLETED" : action === "CANCEL" && current.status === "PLANNED" ? "CANCELLED" : "";
  if (!target) throw new OperationalWorkflowError("Maintenance action is not valid for the current state.", 409, "INVALID_TRANSITION");
  const note = safeNote(input.note, "Maintenance note", 5, 500);
  return client.$transaction(async (tx) => {
    const changed = await tx.maintenanceWindow.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: target, version: { increment: 1 }, ...(target === "ACTIVE" ? { actualStartAt: now } : {}), ...(target === "COMPLETED" ? { actualEndAt: now } : {}) } });
    if (changed.count !== 1) throw stale();
    await tx.maintenanceWindowEvent.create({ data: { maintenanceWindowId: current.id, eventType: action, notesSafe: note, actorUserId, version: expectedVersion + 1, occurredAt: now } });
    return tx.maintenanceWindow.findUniqueOrThrow({ where: { id: current.id }, include: { events: { orderBy: { occurredAt: "desc" } } } });
  });
}

export async function saveClientVersionPolicy(client: PrismaClient, input: Record<string, unknown>, actorUserId: string) {
  const environment = safeCode(input.environment ?? process.env.NALANDA_ENVIRONMENT ?? "local", 40);
  const currentVersion = version(input.currentVersion, "Current version");
  const minimumSupportedVersion = version(input.minimumSupportedVersion, "Minimum supported version");
  const updateAvailableVersion = input.updateAvailableVersion ? version(input.updateAvailableVersion, "Available version") : null;
  const enforcementMode = String(input.enforcementMode ?? "ADVISORY").toUpperCase();
  if (enforcementMode !== "ADVISORY") throw new OperationalWorkflowError("OBS-1A permits advisory client policy only; forced refresh is not authorised.");
  const old = await client.clientVersionPolicy.findUnique({ where: { environment } });
  if (old && old.version !== positiveVersion(input.expectedVersion)) throw stale();
  return client.clientVersionPolicy.upsert({ where: { environment }, create: { environment, currentVersion, minimumSupportedVersion, updateAvailableVersion, updateMessageSafe: optionalSafeNote(input.updateMessage, 300), enforcementMode, updatedByUserId: actorUserId }, update: { currentVersion, minimumSupportedVersion, updateAvailableVersion, updateMessageSafe: optionalSafeNote(input.updateMessage, 300), enforcementMode, version: { increment: 1 }, updatedByUserId: actorUserId } });
}

function operationalDomain(value: unknown): OperationalDomain {
  const domain = String(value ?? "").toUpperCase();
  if (!(OPERATIONAL_DOMAINS as readonly string[]).includes(domain)) throw new OperationalWorkflowError("Operational domain is not supported.");
  return domain as OperationalDomain;
}

function positiveVersion(value: unknown) { const version = Number(value); if (!Number.isSafeInteger(version) || version < 1) throw new OperationalWorkflowError("Expected version is required."); return version; }
function severityValue(value: unknown) { const result = String(value ?? "").toUpperCase(); if (!["INFO", "WARNING", "HIGH", "CRITICAL"].includes(result)) throw new OperationalWorkflowError("Severity is not supported."); return result; }
function stale() { return new OperationalWorkflowError("The record changed; refresh and try again.", 409, "STALE_VERSION"); }
function optionalActor(value: unknown) { const result = String(value ?? "").trim(); return result ? safeCode(result, 100) : null; }
function safeCode(value: unknown, maximum: number) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9._-]+$/.test(result) || result.length > maximum) throw new OperationalWorkflowError("A technical identifier is invalid."); return result; }
function version(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9._-]{1,80}$/.test(result)) throw new OperationalWorkflowError(`${label} is invalid.`); return result; }
function safeRunbook(value: unknown) { const result = String(value ?? "").trim(); if (!/^\/(?:docs|technical-operations)(?:\/[A-Za-z0-9._-]+)*\.?(?:md)?$/.test(result)) throw new OperationalWorkflowError("Runbook path is invalid."); return result; }
function safeNote(value: unknown, label: string, minimum: number, maximum: number) { const result = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim(); if (result.length < minimum || result.length > maximum || /(?:password|secret|token|cookie|salary|mark|guardian|payment reference|[a-z]:\\|\/home\/)/i.test(result)) throw new OperationalWorkflowError(`${label} is missing, too long or contains restricted private data.`); return result; }
function optionalSafeNote(value: unknown, maximum: number) { const result = String(value ?? "").trim(); return result ? safeNote(result, "Note", 1, maximum) : null; }
function futureDate(value: unknown, now: Date) { const result = new Date(String(value ?? "")); if (!Number.isFinite(result.valueOf()) || result < new Date(now.valueOf() - 5 * 60 * 1000)) throw new OperationalWorkflowError("A valid future date is required."); return result; }
function boundedFutureDate(value: unknown, now: Date, maximumDays: number) { const result = futureDate(value, now); if (result.valueOf() - now.valueOf() > maximumDays * 24 * 60 * 60 * 1000) throw new OperationalWorkflowError(`The date must be within ${maximumDays} days.`); return result; }
function stringList(value: unknown, maximum: number) { if (!Array.isArray(value) || value.length > maximum) throw new OperationalWorkflowError("A bounded list is required."); return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]; }
