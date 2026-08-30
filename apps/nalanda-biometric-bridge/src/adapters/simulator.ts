import type { DeviceAdapter, ConfiguredDevice } from "./adapter.js";
import type { NormalizedEvent } from "../contracts.js";

export const SIMULATOR_SCENARIOS = ["normal", "duplicate", "repeated-batch", "exact-replay", "changed-replay", "late-arrival", "out-of-order-logs", "offline-backlog", "bridge-restart", "clock-drift", "clock-drift-plus-5", "clock-drift-minus-5", "severe-clock-drift", "unknown-staff", "inactive-staff", "revoked-bridge", "revoked-device", "missing-in", "missing-out", "multiple-punches", "holiday-punch", "approved-leave-punch", "firmware-reset", "sequence-reset", "replay", "malformed", "oversized-event", "batch-interruption", "timeout-before-commit", "timeout-after-commit", "morning-burst-80", "evening-burst-80", "week-backlog", "month-load"] as const;
export type SimulatorScenario = (typeof SIMULATOR_SCENARIOS)[number];
const BASE = Date.parse("2026-08-28T02:30:00.000Z");

export class SimulatorAdapter implements DeviceAdapter { readonly profile = "SIMULATOR" as const; readonly officialProtocolRequired = false; constructor(private scenario: SimulatorScenario = "normal") {} async poll(device: ConfiguredDevice) { return simulateScenario(this.scenario, device.deviceId); } }

export function simulateScenario(scenario: SimulatorScenario, deviceId: string): NormalizedEvent[] {
  if (!SIMULATOR_SCENARIOS.includes(scenario)) throw new Error("SIMULATOR_SCENARIO_INVALID");
  const event = (user: string, minute: number, punchCode: "IN"|"OUT"|"UNKNOWN", sequence: number, extra: Partial<NormalizedEvent> = {}): NormalizedEvent => ({ deviceId, opaqueDeviceUserId: user, punchTimestamp: new Date(BASE + minute * 60_000).toISOString(), bridgeReceivedTimestamp: new Date(BASE + minute * 60_000 + 1_000).toISOString(), estimatedClockDriftSeconds: 0, verificationMethod: "FINGERPRINT", punchCode, statusCode: null, sequenceNumber: sequence, sequenceEpoch: 1, eventReference: `SIM-${scenario}-${sequence}`, protocolProfile: "SIMULATOR", ...extra });
  if (scenario === "normal") return [event("STAFF-001",0,"IN",1),event("STAFF-001",480,"OUT",2)];
  if (["duplicate", "repeated-batch", "exact-replay", "replay"].includes(scenario)) { const row=event("STAFF-001",0,"IN",1); return [row,{...row}]; }
  if (scenario === "changed-replay") { const row=event("STAFF-001",0,"IN",1); return [row,{...row,punchTimestamp:new Date(BASE+60_000).toISOString()}]; }
  if (["late-arrival", "offline-backlog", "bridge-restart"].includes(scenario)) return [event("STAFF-001",-1440,"IN",1),event("STAFF-001",-960,"OUT",2)];
  if (scenario === "out-of-order-logs") return [event("STAFF-001",480,"OUT",2),event("STAFF-001",0,"IN",1)];
  if (scenario === "clock-drift" || scenario === "clock-drift-plus-5") return [event("STAFF-001",30,"IN",1,{estimatedClockDriftSeconds:300}),event("STAFF-001",510,"OUT",2,{estimatedClockDriftSeconds:300})];
  if (scenario === "clock-drift-minus-5") return [event("STAFF-001",0,"IN",1,{estimatedClockDriftSeconds:-300}),event("STAFF-001",480,"OUT",2,{estimatedClockDriftSeconds:-300})];
  if (scenario === "severe-clock-drift") return [event("STAFF-001",0,"IN",1,{estimatedClockDriftSeconds:3600}),event("STAFF-001",480,"OUT",2,{estimatedClockDriftSeconds:3600})];
  if (scenario === "unknown-staff") return [event("UNKNOWN-999",0,"IN",1)];
  if (["inactive-staff", "revoked-bridge", "revoked-device", "holiday-punch", "approved-leave-punch"].includes(scenario)) return [event("STAFF-001",0,"IN",1)];
  if (scenario === "missing-in") return [event("STAFF-001",480,"OUT",1)];
  if (scenario === "missing-out") return [event("STAFF-001",0,"IN",1)];
  if (scenario === "multiple-punches") return [event("STAFF-001",0,"IN",1),event("STAFF-001",180,"OUT",2),event("STAFF-001",210,"IN",3),event("STAFF-001",480,"OUT",4)];
  if (scenario === "firmware-reset" || scenario === "sequence-reset") return [event("STAFF-001",0,"IN",1,{sequenceEpoch:2,eventReference:"SIM-RESET-1"})];
  if (scenario === "malformed") return [{...event("STAFF-001",0,"UNKNOWN",1),opaqueDeviceUserId:""}];
  if (scenario === "oversized-event") return [{...event("STAFF-001",0,"IN",1),opaqueDeviceUserId:"X".repeat(129)}];
  if (["batch-interruption", "timeout-before-commit", "timeout-after-commit"].includes(scenario)) return Array.from({length:10},(_,i)=>event(`STAFF-${String(i+1).padStart(3,"0")}`,i,"IN",i+1));
  if (scenario === "evening-burst-80") return Array.from({length:80},(_,i)=>event(`STAFF-${String(i+1).padStart(3,"0")}`,480+(i%10),"OUT",i+1));
  if (scenario === "week-backlog") return Array.from({length:7*160},(_,i)=>event(`STAFF-${String((i%80)+1).padStart(3,"0")}`,-10_080+Math.floor(i/160)*1_440+(i%160<80?i%10:480+i%10),i%160<80?"IN":"OUT",i+1));
  if (scenario === "month-load") return Array.from({length:30*160},(_,i)=>event(`STAFF-${String((i%80)+1).padStart(3,"0")}`,-43_200+Math.floor(i/160)*1_440+(i%160<80?i%10:480+i%10),i%160<80?"IN":"OUT",i+1));
  return Array.from({length:80},(_,i)=>event(`STAFF-${String(i+1).padStart(3,"0")}`,i%10,"IN",i+1));
}
