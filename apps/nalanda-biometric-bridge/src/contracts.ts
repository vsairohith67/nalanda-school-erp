export const PROFILES = ["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH", "GENERIC_ADMS_PUSH", "GENERIC_LAN_POLL", "GENERIC_CSV_IMPORT", "SIMULATOR"] as const;
export type Profile = (typeof PROFILES)[number];
export type NormalizedEvent = { deviceId: string; opaqueDeviceUserId: string; punchTimestamp: string; bridgeReceivedTimestamp: string; estimatedClockDriftSeconds: number | null; verificationMethod: "FINGERPRINT" | "FACE" | "CARD" | "PIN" | "OTHER"; punchCode: "IN" | "OUT" | "UNKNOWN"; statusCode: string | null; sequenceNumber: number | null; sequenceEpoch: number; eventReference: string | null; protocolProfile: Profile };
export type QueueStateName = "RECEIVED_FROM_DEVICE" | "QUEUED" | "SENDING" | "ACKNOWLEDGED" | "DUPLICATE_ACKNOWLEDGED" | "REJECTED" | "NEEDS_ADMIN_REVIEW";
export type QueueEvent = NormalizedEvent & { queuedAt: string; localState: QueueStateName; attemptCount: number; acknowledgedAt?: string; lastErrorCode?: string };
export type IngestEnvelope = { schemaVersion: 1; batchReference: string; bridgeTime: string; events: NormalizedEvent[] };
export type BridgeConfig = { bridgeId: string; erpUrl: string; privateKeyPath: string; queuePath: string; healthPath: string; pollIntervalMs: number; devices: Array<{ deviceId: string; host: string; port: number; profile: Profile; csvInbox?: string }> };
export const VENDOR_PROFILES = new Set<Profile>(["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH"]);
export const GENERIC_PENDING_PROFILES = new Set<Profile>(["GENERIC_ADMS_PUSH", "GENERIC_LAN_POLL"]);

export function validateNormalizedEvent(value: NormalizedEvent) {
  if (!/^[0-9a-f-]{36}$/i.test(value.deviceId) || !/^[A-Za-z0-9._:@/-]{1,128}$/.test(value.opaqueDeviceUserId)) throw new Error("NORMALIZED_EVENT_ID_INVALID");
  if (!PROFILES.includes(value.protocolProfile)) throw new Error("NORMALIZED_EVENT_PROFILE_INVALID");
  if (!(["FINGERPRINT", "FACE", "CARD", "PIN", "OTHER"] as const).includes(value.verificationMethod)) throw new Error("NORMALIZED_EVENT_METHOD_INVALID");
  if (!(["IN", "OUT", "UNKNOWN"] as const).includes(value.punchCode)) throw new Error("NORMALIZED_EVENT_PUNCH_CODE_INVALID");
  if (value.punchTimestamp.length < 20 || value.punchTimestamp.length > 40 || Number.isNaN(new Date(value.punchTimestamp).getTime())) throw new Error("NORMALIZED_EVENT_TIMESTAMP_INVALID");
  if (value.bridgeReceivedTimestamp.length < 20 || value.bridgeReceivedTimestamp.length > 40 || Number.isNaN(new Date(value.bridgeReceivedTimestamp).getTime())) throw new Error("NORMALIZED_EVENT_BRIDGE_TIMESTAMP_INVALID");
  if (value.estimatedClockDriftSeconds !== null && (!Number.isSafeInteger(value.estimatedClockDriftSeconds) || Math.abs(value.estimatedClockDriftSeconds) > 604_800)) throw new Error("NORMALIZED_EVENT_CLOCK_DRIFT_INVALID");
  if (value.sequenceNumber !== null && (!Number.isSafeInteger(value.sequenceNumber) || value.sequenceNumber < 0)) throw new Error("NORMALIZED_EVENT_SEQUENCE_INVALID");
  if (!Number.isSafeInteger(value.sequenceEpoch) || value.sequenceEpoch < 1 || value.sequenceEpoch > 1_000_000) throw new Error("NORMALIZED_EVENT_SEQUENCE_EPOCH_INVALID");
  validateMetadata(value.statusCode, 80);
  validateMetadata(value.eventReference, 160);
  if (/(template|image|secret|password)/i.test(JSON.stringify(Object.keys(value)))) throw new Error("NORMALIZED_EVENT_PRIVACY_BOUNDARY_FAILED");
  return value;
}

function validateMetadata(value: string | null, max: number) {
  if (value === null) return;
  if (value.length < 1 || value.length > max || !/^[A-Za-z0-9._:@/-]+$/.test(value) || /(fingerprint|face|biometric|template|image|secret|password|privatekey)/i.test(value)) throw new Error("NORMALIZED_EVENT_METADATA_INVALID");
}
