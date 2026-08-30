import { readFileSync } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import { PROFILES, type BridgeConfig } from "./contracts.js";

export function loadBridgeConfig(file = process.env.NALANDA_BIOMETRIC_BRIDGE_CONFIG) {
  if (!file) throw new Error("BRIDGE_CONFIG_PATH_REQUIRED");
  const resolved = path.resolve(file), source = JSON.parse(readFileSync(resolved, "utf8")) as Partial<BridgeConfig>;
  if (!/^[0-9a-f-]{36}$/i.test(String(source.bridgeId ?? ""))) throw new Error("BRIDGE_ID_INVALID");
  const erp = new URL(String(source.erpUrl ?? ""));
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(erp.hostname);
  if (erp.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && loopback)) throw new Error("BRIDGE_HTTPS_REQUIRED");
  if (erp.username || erp.password || erp.search || erp.hash) throw new Error("BRIDGE_ERP_URL_INVALID");
  if (!Array.isArray(source.devices) || source.devices.length < 1 || source.devices.length > 32) throw new Error("BRIDGE_ALLOW_LIST_INVALID");
  const seen = new Set<string>();
  const devices = source.devices.map((row) => {
    if (!row || !/^[0-9a-f-]{36}$/i.test(String(row.deviceId ?? "")) || !PROFILES.includes(row.profile as any)) throw new Error("BRIDGE_DEVICE_CONFIG_INVALID");
    if (!privateLanHost(String(row.host ?? ""))) throw new Error("BRIDGE_DEVICE_HOST_NOT_PRIVATE");
    const port = Number(row.port); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("BRIDGE_DEVICE_PORT_INVALID");
    const key = `${row.host}:${port}`; if (seen.has(key)) throw new Error("BRIDGE_DEVICE_DUPLICATE"); seen.add(key);
    return { deviceId: String(row.deviceId), host: String(row.host), port, profile: row.profile!, ...(row.csvInbox ? { csvInbox: path.resolve(String(row.csvInbox)) } : {}) };
  });
  const base = path.dirname(resolved);
  const pollIntervalMs = Number(source.pollIntervalMs ?? 30_000); if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 5_000 || pollIntervalMs > 3_600_000) throw new Error("BRIDGE_POLL_INTERVAL_INVALID");
  return { bridgeId: String(source.bridgeId), erpUrl: erp.origin, privateKeyPath: inside(base, source.privateKeyPath, "BRIDGE_PRIVATE_KEY_PATH_INVALID"), queuePath: inside(base, source.queuePath, "BRIDGE_QUEUE_PATH_INVALID"), healthPath: inside(base, source.healthPath, "BRIDGE_HEALTH_PATH_INVALID"), pollIntervalMs, devices } satisfies BridgeConfig;
}

function privateLanHost(host: string) { const version = isIP(host); if (version === 4) { const parts = host.split(".").map(Number); return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 127; } if (version === 6) return host === "::1" || /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host); return false; }
function inside(base: string, value: unknown, code: string) { const resolved = path.resolve(base, String(value ?? "")), relative = path.relative(base, resolved); if (!value || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(code); return resolved; }
