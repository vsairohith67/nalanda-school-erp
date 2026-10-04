import { createHash, createPrivateKey, randomBytes, sign, type JsonWebKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizedEvent, type BridgeConfig, type QueueEvent, type IngestEnvelope } from "./contracts.js";
import type { PreparedBatch } from "./encrypted-queue.js";
import { runtimeSecrets } from "./runtime-secrets.js";

export async function syncQueuedEvents(config: BridgeConfig, events: QueueEvent[], batchReference?: string) {
  const reference = batchReference ?? `bridge-${sha256(JSON.stringify(events.map(normalizedEvent))).slice(0, 48)}`;
  const body = JSON.stringify({ schemaVersion: 1, batchReference: reference, bridgeTime: new Date().toISOString(), events: events.map(normalizedEvent) } satisfies IngestEnvelope);
  return syncPreparedBatch(config, { reference, body, identities: events.map((_, i) => String(i)), attempts: 0, nextAttemptAt: 0 });
}
export async function syncPreparedBatch(config: BridgeConfig, batch: PreparedBatch, signal?: AbortSignal, timeoutMs = 30_000) {
  if (!config.transportEnabled) throw new Error("BRIDGE_TRANSPORT_OFF");
  const count = batch.identities.length;
  if (count < 1 || count > 100 || Buffer.byteLength(batch.body) > 256 * 1024) throw new Error("BRIDGE_SYNC_BATCH_INVALID");
  const timestamp = String(Date.now()), nonce = randomBytes(24).toString("base64url"), bodyHash = sha256(batch.body), url = new URL("/api/biometric/ingest", config.erpUrl);
  const secret = runtimeSecrets();
  if (secret && !secret.signingKey) throw new Error("BRIDGE_PRIVATE_KEY_INVALID");
  const jwk = secret?.signingKey ?? JSON.parse(readFileSync(config.privateKeyPath, "utf8")) as JsonWebKey;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d) throw new Error("BRIDGE_PRIVATE_KEY_INVALID");
  const keyVersion = secret?.keyVersion ?? Number(process.env.NALANDA_BIOMETRIC_BRIDGE_KEY_VERSION ?? 1);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) throw new Error("BRIDGE_KEY_VERSION_INVALID");
  const message = ["nalanda-biometric-request-v1", "POST", url.pathname, timestamp, nonce, bodyHash, config.bridgeId, String(keyVersion), "1"].join("\n");
  const signature = sign(null, Buffer.from(message), createPrivateKey({ key: jwk, format: "jwk" })).toString("base64url");
  const response = await fetch(url, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", "x-nalanda-biometric-bridge-id": config.bridgeId, "x-nalanda-biometric-timestamp": timestamp, "x-nalanda-biometric-nonce": nonce, "x-nalanda-biometric-body-sha256": bodyHash, "x-nalanda-biometric-signature": signature, "x-nalanda-biometric-key-version": String(keyVersion), "x-nalanda-biometric-schema": "1" }, body: batch.body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
  const reader = response.body?.getReader(); let bytes = 0, text = "";
  if (reader) { try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 16_384) throw new Error("BRIDGE_ACK_INVALID"); text += Buffer.from(chunk.value).toString("utf8"); } } finally { await reader.cancel(); } }
  let result: any; try { result = JSON.parse(text); } catch { throw new Error("BRIDGE_ACK_INVALID"); }
  if (!response.ok) throw new Error(`BRIDGE_SYNC_REJECTED:${/^[A-Z0-9_]{1,100}$/.test(result.code ?? "") ? result.code : response.status}`);
  return validateAcknowledgement(result, batch.reference, count);
}
export function validateAcknowledgement(r: any, reference: string, count: number) {
  const ints = [r?.accepted, r?.duplicates, r?.exceptions];
  if (r?.schemaVersion !== 1 || r?.batchReference !== reference || !["ACCEPTED", "DUPLICATE_ACCEPTED"].includes(r?.status) || ints.some(n => !Number.isSafeInteger(n) || n < 0 || n > count) || r.exceptions > r.accepted || typeof r.serverTime !== "string" || Number.isNaN(Date.parse(r.serverTime))) throw new Error("BRIDGE_ACK_INVALID");
  if (r.status === "DUPLICATE_ACCEPTED" ? r.accepted !== count || r.duplicates !== count || r.exceptions !== 0 : r.accepted + r.duplicates !== count) throw new Error("BRIDGE_ACK_INVALID");
  return { duplicate: r.status === "DUPLICATE_ACCEPTED", serverTime: r.serverTime as string };
}
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
