import { createHash, createPrivateKey, randomBytes, sign, type JsonWebKey as CryptoJsonWebKey } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BridgeConfig, IngestEnvelope, QueueEvent } from "./contracts.js";

export async function syncQueuedEvents(config: BridgeConfig, events: QueueEvent[], batchReference = stableBatchReference(events)) {
  if (!events.length || events.length > 100) throw new Error("BRIDGE_SYNC_BATCH_INVALID");
  const envelope: IngestEnvelope = { schemaVersion: 1, batchReference, bridgeTime: new Date().toISOString(), events: events.map(({queuedAt:_,localState:__,attemptCount:___,acknowledgedAt:____,lastErrorCode:_____,...event})=>event) };
  const body = JSON.stringify(envelope), bodyHash = sha256(body), timestamp = String(Date.now()), nonce = randomBytes(24).toString("base64url"), url = new URL("/api/biometric/ingest", config.erpUrl);
  const privateJwk = JSON.parse(readFileSync(config.privateKeyPath, "utf8")) as CryptoJsonWebKey; if (privateJwk.kty !== "OKP" || privateJwk.crv !== "Ed25519" || !privateJwk.d) throw new Error("BRIDGE_PRIVATE_KEY_INVALID");
  const keyVersion = Number(process.env.NALANDA_BIOMETRIC_BRIDGE_KEY_VERSION ?? 1); if (!Number.isInteger(keyVersion) || keyVersion < 1) throw new Error("BRIDGE_KEY_VERSION_INVALID");
  const message = ["nalanda-biometric-request-v1", "POST", url.pathname, timestamp, nonce, bodyHash, config.bridgeId, String(keyVersion), "1"].join("\n");
  const signature = sign(null, Buffer.from(message), createPrivateKey({key:privateJwk,format:"jwk"})).toString("base64url");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json", "Content-Length":String(Buffer.byteLength(body)), "x-nalanda-biometric-bridge-id":config.bridgeId, "x-nalanda-biometric-timestamp":timestamp, "x-nalanda-biometric-nonce":nonce, "x-nalanda-biometric-body-sha256":bodyHash, "x-nalanda-biometric-signature":signature, "x-nalanda-biometric-key-version":String(keyVersion), "x-nalanda-biometric-schema":"1" }, body, signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(()=>({})); if (!response.ok) throw new Error(`BRIDGE_SYNC_REJECTED:${String((result as any).code??response.status)}`); return result;
}
function sha256(value:string){return createHash("sha256").update(value).digest("hex");}
function stableBatchReference(events: QueueEvent[]) { const normalized = events.map(({ queuedAt: _, localState: __, attemptCount: ___, acknowledgedAt: ____, lastErrorCode: _____, ...event }) => event); return `bridge-${sha256(JSON.stringify(normalized)).slice(0, 48)}`; }
