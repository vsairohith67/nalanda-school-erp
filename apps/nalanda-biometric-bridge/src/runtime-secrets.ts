import type { JsonWebKey } from "node:crypto";
export type RuntimeSecrets = { queueKey: string; signingKey?: JsonWebKey; keyVersion: number };
let secrets: RuntimeSecrets | undefined;
export function setRuntimeSecrets(value: RuntimeSecrets) {
  if (Buffer.from(value.queueKey, "base64url").length !== 32 || !Number.isSafeInteger(value.keyVersion) || value.keyVersion < 1) throw new Error("BRIDGE_SECRETS_INVALID");
  secrets = value;
}
export function runtimeSecrets() { return secrets; }
