import { createHash } from "node:crypto";
import { biometricProtocolProfile, type BiometricProtocolProfile } from "@/lib/biometric-attendance/profiles";

export const BIOMETRIC_BATCH_MAX_EVENTS = 100;
export const BIOMETRIC_BODY_MAX_BYTES = 256 * 1024;
export const BIOMETRIC_VERIFICATION_METHODS = ["FINGERPRINT", "FACE", "CARD", "PIN", "OTHER"] as const;
export const BIOMETRIC_PUNCH_CODES = ["IN", "OUT", "UNKNOWN"] as const;

const PROHIBITED_KEY = /(fingerprint|face).*(image|template)|(image|template).*(fingerprint|face)|biometric(database|template)|cardsecret|admin(istrator)?password|devicepassword/i;
const TOP_LEVEL_KEYS = new Set(["schemaVersion", "batchReference", "bridgeTime", "events"]);
const EVENT_KEYS = new Set(["deviceId", "opaqueDeviceUserId", "punchTimestamp", "bridgeReceivedTimestamp", "estimatedClockDriftSeconds", "verificationMethod", "punchCode", "statusCode", "sequenceNumber", "sequenceEpoch", "eventReference", "protocolProfile"]);

export type NormalizedBiometricEvent = {
  deviceId: string;
  opaqueDeviceUserId: string;
  punchTimestamp: string;
  bridgeReceivedTimestamp: string;
  estimatedClockDriftSeconds: number | null;
  verificationMethod: (typeof BIOMETRIC_VERIFICATION_METHODS)[number];
  punchCode: (typeof BIOMETRIC_PUNCH_CODES)[number];
  statusCode: string | null;
  sequenceNumber: number | null;
  sequenceEpoch: number;
  eventReference: string | null;
  protocolProfile: BiometricProtocolProfile;
};

export type BiometricIngestEnvelope = {
  schemaVersion: 1;
  batchReference: string;
  bridgeTime: string;
  events: NormalizedBiometricEvent[];
};

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateBiometricEnvelope(value: unknown, now = new Date()): BiometricIngestEnvelope {
  rejectProhibitedKeys(value);
  const root = object(value, "BIOMETRIC_BATCH_REQUIRED");
  exactKeys(root, TOP_LEVEL_KEYS, "BIOMETRIC_BATCH_FIELD_UNSUPPORTED");
  if (root.schemaVersion !== 1) throw new Error("BIOMETRIC_SCHEMA_UNSUPPORTED");
  const batchReference = identifier(root.batchReference, "BIOMETRIC_BATCH_REFERENCE_INVALID", 8, 160);
  const bridgeTime = timestamp(root.bridgeTime, "BIOMETRIC_BRIDGE_TIME_INVALID", now, 10 * 60 * 1000, 48 * 60 * 60 * 1000);
  if (!Array.isArray(root.events) || root.events.length < 1 || root.events.length > BIOMETRIC_BATCH_MAX_EVENTS) throw new Error("BIOMETRIC_BATCH_SIZE_INVALID");
  const references = new Set<string>();
  const events = root.events.map((raw, index) => {
    const row = object(raw, `BIOMETRIC_EVENT_${index + 1}_INVALID`);
    exactKeys(row, EVENT_KEYS, "BIOMETRIC_EVENT_FIELD_UNSUPPORTED");
    const deviceId = uuid(row.deviceId, "BIOMETRIC_DEVICE_ID_INVALID");
    const opaqueDeviceUserId = identifier(row.opaqueDeviceUserId, "BIOMETRIC_DEVICE_USER_ID_INVALID", 1, 128);
    const punchTimestamp = timestamp(row.punchTimestamp, "BIOMETRIC_PUNCH_TIMESTAMP_INVALID", now, 10 * 60 * 1000, 370 * 86_400_000);
    const bridgeReceivedTimestamp = timestamp(row.bridgeReceivedTimestamp, "BIOMETRIC_BRIDGE_RECEIVED_TIMESTAMP_INVALID", now, 10 * 60 * 1000, 48 * 60 * 60 * 1000);
    const estimatedClockDriftSeconds = optionalInteger(row.estimatedClockDriftSeconds, -604_800, 604_800, "BIOMETRIC_CLOCK_DRIFT_INVALID");
    const verificationMethod = String(row.verificationMethod ?? "").trim().toUpperCase() as NormalizedBiometricEvent["verificationMethod"];
    if (!BIOMETRIC_VERIFICATION_METHODS.includes(verificationMethod)) throw new Error("BIOMETRIC_VERIFICATION_METHOD_INVALID");
    const punchCode = String(row.punchCode ?? "").trim().toUpperCase() as NormalizedBiometricEvent["punchCode"];
    if (!BIOMETRIC_PUNCH_CODES.includes(punchCode)) throw new Error("BIOMETRIC_PUNCH_CODE_INVALID");
    const statusCode = optionalText(row.statusCode, 80);
    const sequenceNumber = optionalInteger(row.sequenceNumber, 0, Number.MAX_SAFE_INTEGER, "BIOMETRIC_SEQUENCE_INVALID");
    const sequenceEpoch = row.sequenceEpoch == null ? 1 : integer(row.sequenceEpoch, 1, 1_000_000, "BIOMETRIC_SEQUENCE_EPOCH_INVALID");
    const eventReference = optionalText(row.eventReference, 160);
    const protocolProfile = biometricProtocolProfile(row.protocolProfile);
    if (eventReference) {
      const key = `${deviceId}:${eventReference}`;
      if (references.has(key)) throw new Error("BIOMETRIC_DUPLICATE_EVENT_REFERENCE_IN_BATCH");
      references.add(key);
    }
    return { deviceId, opaqueDeviceUserId, punchTimestamp, bridgeReceivedTimestamp, estimatedClockDriftSeconds, verificationMethod, punchCode, statusCode, sequenceNumber, sequenceEpoch, eventReference, protocolProfile };
  });
  return { schemaVersion: 1, batchReference, bridgeTime, events };
}

export function biometricEventIdentity(event: NormalizedBiometricEvent) {
  const stableReference = event.sequenceNumber !== null
    ? `sequence:${event.sequenceEpoch}:${event.sequenceNumber}`
    : event.eventReference
      ? `reference:${event.eventReference}`
      : `fallback:${event.opaqueDeviceUserId}:${event.punchTimestamp}:${event.punchCode}:${event.statusCode ?? ""}`;
  return sha256Hex(`biometric-event-v1\n${event.deviceId}\n${stableReference}`);
}

function rejectProhibitedKeys(value: unknown, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PROHIBITED_KEY.test(key.replaceAll(/[^a-z]/gi, ""))) throw new Error("BIOMETRIC_SECRET_OR_TEMPLATE_FIELD_FORBIDDEN");
    rejectProhibitedKeys(child, depth + 1);
  }
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, code: string) { for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${code}:${key}`); }
function object(value: unknown, code: string) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); return value as Record<string, unknown>; }
function identifier(value: unknown, code: string, min: number, max: number) { const text = String(value ?? "").trim(); if (text.length < min || text.length > max || !/^[A-Za-z0-9._:@/-]+$/.test(text)) throw new Error(code); return text; }
function uuid(value: unknown, code: string) { const text = String(value ?? "").trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(code); return text; }
function optionalText(value: unknown, max: number) { if (value == null || String(value).trim() === "") return null; const text = String(value).trim(); if (text.length > max || !/^[A-Za-z0-9._:@/-]+$/.test(text) || /(fingerprint|face|biometric|template|image|secret|password|privatekey)/i.test(text)) throw new Error("BIOMETRIC_TEXT_INVALID"); return text; }
function optionalInteger(value: unknown, min: number, max: number, code: string) { return value == null ? null : integer(value, min, max, code); }
function integer(value: unknown, min: number, max: number, code: string) { const number = Number(value); if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(code); return number; }
function timestamp(value: unknown, code: string, now: Date, futureMs: number, pastMs: number) { const text = String(value ?? "").trim(); const time = new Date(text); if (text.length < 20 || text.length > 40 || Number.isNaN(time.getTime()) || time.getTime() > now.getTime() + futureMs || time.getTime() < now.getTime() - pastMs) throw new Error(code); return time.toISOString(); }
