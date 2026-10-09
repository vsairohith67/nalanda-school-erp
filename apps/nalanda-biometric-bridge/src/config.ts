import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import { EXPORT_PROFILE, validateExportProfile, type ExportInput } from "./export-profile.js";
import { assertSourceBoundary, assertNoLinks, pathsOverlap } from "./export-source.js";
import { PROFILES, type BridgeConfig } from "./contracts.js";

export function loadBridgeConfig(file = process.env.NALANDA_BIOMETRIC_BRIDGE_CONFIG) {
  if (!file) throw new Error("BRIDGE_CONFIG_PATH_REQUIRED");
  const resolved = path.resolve(file);
  if (statSync(resolved).size > 2 * 1024 * 1024) throw new Error("BRIDGE_CONFIG_TOO_LARGE");
  const source = JSON.parse(readFileSync(resolved, "utf8")) as Partial<BridgeConfig>;
  if (!/^[0-9a-f-]{36}$/i.test(String(source.bridgeId ?? ""))) throw new Error("BRIDGE_ID_INVALID");
  const erp = new URL(String(source.erpUrl ?? ""));
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(erp.hostname);
  if (erp.protocol !== "https:" && !(source.syntheticOnly === true && loopback && erp.protocol === "http:")) throw new Error("BRIDGE_HTTPS_REQUIRED");
  if (erp.username || erp.password || erp.search || erp.hash) throw new Error("BRIDGE_ERP_URL_INVALID");
  if (!Array.isArray(source.devices) || source.devices.length < 1 || source.devices.length > 32) throw new Error("BRIDGE_ALLOW_LIST_INVALID");
  const base = path.dirname(resolved), seen = new Set<string>();
  const devices = source.devices.map((row) => {
    if (!row || !/^[0-9a-f-]{36}$/i.test(String(row.deviceId ?? "")) || !PROFILES.includes(row.profile as any)) throw new Error("BRIDGE_DEVICE_CONFIG_INVALID");
    if (!privateLanHost(String(row.host ?? ""))) throw new Error("BRIDGE_DEVICE_HOST_NOT_PRIVATE");
    if (source.syntheticOnly === true && (!["SIMULATOR", "GENERIC_CSV_IMPORT", EXPORT_PROFILE].includes(String(row.profile)) || !["127.0.0.1", "::1"].includes(String(row.host)))) throw new Error("BRIDGE_SYNTHETIC_DEVICE_INVALID");
    const port = Number(row.port); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("BRIDGE_DEVICE_PORT_INVALID");
    const key = `${row.host}:${port}`; if (seen.has(key) || seen.has(String(row.deviceId))) throw new Error("BRIDGE_DEVICE_DUPLICATE"); seen.add(key); seen.add(String(row.deviceId));
    let exportInput: ExportInput | undefined;
    if (row.profile===EXPORT_PROFILE) {
      const input=row.exportInput;
      if (!input || Object.keys(input).sort().join(",")!=="profile,sourceAccessSids,sourceDirectory,staleAfterMs" || typeof input.sourceDirectory!=="string" || !Array.isArray(input.sourceAccessSids) || input.sourceAccessSids.length<1 || input.sourceAccessSids.length>6 || input.sourceAccessSids.some(s=>typeof s!=="string" || !/^S-1-[0-9-]{3,150}$/.test(s) || ["S-1-1-0","S-1-5-11","S-1-5-32-545","S-1-5-32-546"].includes(s)) || !Number.isSafeInteger(input.staleAfterMs) || input.staleAfterMs<60_000 || input.staleAfterMs>7*86_400_000 || row.host!=="127.0.0.1" || port!==1 || row.csvInbox) throw new Error("EXPORT_CONFIG_INVALID");
      exportInput={...input,profile:validateExportProfile(input.profile)};
    } else if (row.exportInput) throw new Error("EXPORT_PROFILE_MISMATCH");
    return { ...(exportInput?{exportInput}:{}), deviceId: String(row.deviceId), host: String(row.host), port, profile: row.profile!, ...(row.csvInbox ? { csvInbox: inside(base, row.csvInbox, "BRIDGE_CSV_PATH_INVALID") } : {}) };
  });
  const pollIntervalMs = Number(source.pollIntervalMs ?? 60_000); if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 5_000 || pollIntervalMs > 3_600_000) throw new Error("BRIDGE_POLL_INTERVAL_INVALID");
  if (source.transportEnabled !== undefined && typeof source.transportEnabled !== "boolean") throw new Error("BRIDGE_TRANSPORT_FLAG_INVALID");
  const config = { bridgeId: String(source.bridgeId), erpUrl: erp.origin, privateKeyPath: inside(base, source.privateKeyPath, "BRIDGE_PRIVATE_KEY_PATH_INVALID"), queuePath: inside(base, source.queuePath, "BRIDGE_QUEUE_PATH_INVALID"), healthPath: inside(base, source.healthPath, "BRIDGE_HEALTH_PATH_INVALID"), pollIntervalMs, transportEnabled: source.transportEnabled === true, syntheticOnly: source.syntheticOnly === true, devices } satisfies BridgeConfig;
  const reserved=[resolved,config.privateKeyPath,config.queuePath,config.healthPath,`${config.queuePath}.pid.lock`,`${config.queuePath}.pid.lock.acquire`];
  for (const file of reserved) assertNoLinks(file,true);
  if (reserved.some((file,i)=>reserved.slice(i+1).some(other=>pathsOverlap(file,other)))) throw new Error("BRIDGE_PATH_COLLISION");
  if (devices.some(d => d.csvInbox && [config.privateKeyPath, config.queuePath, config.healthPath, resolved].map(p=>p.toLowerCase()).includes(d.csvInbox.toLowerCase()))) throw new Error("BRIDGE_PATH_COLLISION");
  const exports=devices.filter(d=>d.exportInput);
  if (exports.length>1) throw new Error("EXPORT_SINGLE_DIRECTORY_REQUIRED");
  for (const device of exports) assertSourceBoundary(device.exportInput!.sourceDirectory,[base,path.dirname(config.privateKeyPath),path.dirname(config.queuePath),path.dirname(config.healthPath)]);
  return config;
}

function privateLanHost(host: string) { const version = isIP(host); if (version === 4) { const parts = host.split(".").map(Number); return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 127; } if (version === 6) return host === "::1" || /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host); return false; }
function inside(base: string, value: unknown, code: string) { const resolved = path.resolve(base, String(value ?? "")), relative = path.relative(base, resolved); if (!value || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(code); return resolved; }
