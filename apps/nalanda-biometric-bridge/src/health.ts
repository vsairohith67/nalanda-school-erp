import type { ExportHealth } from "./adapters/etimetracklite.js";
import { readFileSync } from "node:fs";
import { atomicWrite } from "./atomic-file.js";
type Health = { exportSources?: ExportHealth[]; status: string; queueDepth: number; configuredDevices: number; lastPollAt?: string; lastSyncAt?: string; lastPunchAt?: string; lastErrorCode?: string; processRunning?: boolean; adapterUnavailable?: boolean; reviewCount?: number; transportEnabled?: boolean };
export function writeLocalHealth(file: string, input: Health) {
  let previous: Partial<Health> = {}; try { previous = JSON.parse(readFileSync(file, "utf8")); } catch { /* Health is advisory, never queue state. */ }
  atomicWrite(file, JSON.stringify({ schemaVersion: 2, ...input, lastPollAt: input.lastPollAt ?? previous.lastPollAt, lastPunchAt: input.lastPunchAt ?? previous.lastPunchAt, lastSyncAt: input.lastSyncAt ?? previous.lastSyncAt, updatedAt: new Date().toISOString() }, null, 2));
}
