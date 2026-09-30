import { loadBridgeConfig } from "./config.js";
import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { GenericCsvAdapter } from "./adapters/csv.js";
import { SimulatorAdapter } from "./adapters/simulator.js";
import { VendorProtocolDisabledAdapter } from "./adapters/vendor-disabled.js";
import { GenericContractPendingAdapter } from "./adapters/generic-pending.js";
import type { DeviceAdapter } from "./adapters/adapter.js";
import { EVENT_FIELDS, GENERIC_PENDING_PROFILES, validateNormalizedEvent, type Profile } from "./contracts.js";
import { syncPreparedBatch } from "./sync.js";
import { writeLocalHealth } from "./health.js";
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, unlinkSync, writeFileSync, rmdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { setRuntimeSecrets, type RuntimeSecrets } from "./runtime-secrets.js";
import type { BridgeConfig } from "./contracts.js";
import { K30UnavailableAdapter } from "./adapters/k30.js";

export async function runBridgeCycle(config = loadBridgeConfig(), signal?: AbortSignal, factory = adapterFor, queueFactory = (file: string) => new EncryptedDurableQueue(file)) {
  const queue = queueFactory(config.queuePath); queue.load();
  let lastErrorCode: string | undefined, lastPollAt: string | undefined, lastPunchAt: string | undefined, lastSyncAt: string | undefined, unavailable = false;
  for (const device of config.devices) {
    if (signal?.aborted) break;
    try {
      const adapter = factory(device.profile), normalized = (await adapter.poll(device)).map(event => {
        if (Object.keys(event).some(key => !(EVENT_FIELDS as readonly string[]).includes(key))) throw new Error("NORMALIZED_EVENT_PRIVACY_BOUNDARY_FAILED");
        if (event.deviceId !== device.deviceId || event.protocolProfile !== device.profile) throw new Error("NORMALIZED_EVENT_DEVICE_BINDING_FAILED");
        return validateNormalizedEvent(event);
      });
      if (normalized.length > 20_000) throw new Error("BRIDGE_POLL_CAPACITY_EXCEEDED");
      const events = normalized.map(event => ({ ...event, queuedAt: new Date().toISOString(), localState: "RECEIVED_FROM_DEVICE" as const, attemptCount: 0 }));
      if (events.length) { queue.append(events); await adapter.acknowledgePoll?.(device, normalized); lastPunchAt = new Date().toISOString(); }
      lastPollAt = new Date().toISOString();
    } catch (error) { lastErrorCode = safeCode(error); unavailable ||= /UNAVAILABLE|NOT_VERIFIED|NOT_CONFIGURED/.test(lastErrorCode); }
  }
  if (config.transportEnabled && !signal?.aborted) {
    const batch = queue.prepareBatch();
    if (batch) { try { const ack = await syncPreparedBatch(config, batch, signal); queue.confirmBatch(batch.reference, ack.duplicate); lastSyncAt = new Date().toISOString(); } catch (error) { lastErrorCode = safeCode(error); queue.batchFailed(lastErrorCode); } }
  }
  const reviewCount = queue.load().filter(e => ["NEEDS_ADMIN_REVIEW", "REJECTED"].includes(e.localState)).length;
  writeLocalHealth(config.healthPath, { status: lastErrorCode || reviewCount ? "DEGRADED" : "HEALTHY", queueDepth: queue.size(), configuredDevices: config.devices.length, lastPollAt, lastSyncAt, lastPunchAt, lastErrorCode, adapterUnavailable: unavailable, processRunning: true, reviewCount, transportEnabled: !!config.transportEnabled });
  return { queueDepth: queue.size(), lastErrorCode };
}
function adapterFor(profile: Profile): DeviceAdapter { if (profile === "SIMULATOR") return new SimulatorAdapter(); if (profile === "GENERIC_CSV_IMPORT") return new GenericCsvAdapter(); if (profile === "ESSL_ZK_LAN_SDK") return new K30UnavailableAdapter(); if (GENERIC_PENDING_PROFILES.has(profile)) return new GenericContractPendingAdapter(profile); return new VendorProtocolDisabledAdapter(profile); }
export function safeCode(error: unknown) { const code = error instanceof Error ? error.message : ""; return /^(BRIDGE_|NORMALIZED_|CSV_|VENDOR_|K30_|GENERIC_)[A-Z0-9_:.-]{1,130}$/.test(code) ? code : "BRIDGE_OPERATION_FAILED"; }

export async function runWorker(configFile?: string, signal = new AbortController().signal, resumeHeld = false) {
  const config = loadBridgeConfig(configFile), release = instanceLock(config.queuePath);
  try {
    new EncryptedDurableQueue(config.queuePath).load();
    process.stdout.write("READY\n");
    if (resumeHeld) { new EncryptedDurableQueue(config.queuePath).resumeHeldBatch(); process.stdout.write("RESUMED\n"); return; }
    while (!signal.aborted) { const current = loadBridgeConfig(configFile), started = Date.now();
      if (current.queuePath !== config.queuePath || current.healthPath !== config.healthPath || current.bridgeId !== config.bridgeId) throw new Error("BRIDGE_STORAGE_CHANGE_REQUIRES_RESTART");
      await runBridgeCycle(current, signal); await delay(Math.max(100, current.pollIntervalMs - (Date.now() - started)), undefined, { signal }).catch(error => { if (!signal.aborted) throw error; }); }
  } finally {
    try { const queue = new EncryptedDurableQueue(config.queuePath); writeLocalHealth(config.healthPath, { status: "STOPPED", queueDepth: queue.size(), configuredDevices: config.devices.length, processRunning: false }); } finally { release(); }
  }
}
function instanceLock(queuePath: string) {
  const file = `${queuePath}.pid.lock`; mkdirSync(path.dirname(file), { recursive: true });
  const guard = `${file}.acquire`;
  try { mkdirSync(guard); } catch { throw new Error("BRIDGE_INSTANCE_LOCK_ACQUISITION_BLOCKED"); }
  let fd: number;
  try {
    if (existsSync(file)) {
    const pid = Number(readFileSync(file, "utf8"));
        if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("BRIDGE_INSTANCE_LOCK_INVALID");
    try { process.kill(pid, 0); throw new Error("BRIDGE_INSTANCE_ALREADY_RUNNING"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
      unlinkSync(file);
    }
    try { fd = openSync(file, "wx", 0o600); } catch { throw new Error("BRIDGE_INSTANCE_ALREADY_RUNNING"); }
    writeFileSync(fd, String(process.pid));
  } finally { rmdirSync(guard); }
  return () => { closeSync(fd); unlinkSync(file); };
}
async function main() {
  const abort = new AbortController(); process.on("SIGINT", () => abort.abort()); process.on("SIGTERM", () => abort.abort());
  const lines = createInterface({ input: process.stdin });
  let first = true;
  const configFile = process.argv[process.argv.indexOf("--config") + 1];
  if (process.argv.includes("--supervised")) {
    const secret = await new Promise<RuntimeSecrets>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("BRIDGE_SECRET_STARTUP_TIMEOUT")), 10_000);
      lines.once("line", line => { clearTimeout(timer); try { if (line.length > 16_384) throw new Error(); resolve(JSON.parse(line)); } catch { reject(new Error("BRIDGE_SECRETS_INVALID")); } });
    }); setRuntimeSecrets(secret); first = false;
    lines.on("close", () => abort.abort());
  }
  lines.on("line", line => { if (!first && line === "STOP") abort.abort(); });
  try { await runWorker(process.argv.includes("--config") ? configFile : undefined, abort.signal, process.argv.includes("--resume-held-batch")); } finally { lines.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${safeCode(error)}\n`); process.exitCode = 1; });
