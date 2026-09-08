import { createHash } from "node:crypto";
import { authHashSecret, authSecretMatches } from "@/lib/auth-security";
export const importDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Contains only digests and expiry. No original cells or private records are serialized. */
export function issueImportReceipt(context: unknown, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ digest: importDigest(context), expires: now + 15 * 60_000 })).toString("base64url");
  return `${payload}.${authHashSecret(payload, "bulk-import-preview-v1")}`;
}
export function requireImportReceipt(token: unknown, context: unknown, now = Date.now()) {
  if (typeof token !== "string" || token.length > 1024) throw new Error("Validate this exact import again.");
  const [payload, signature, extra] = token.split(".");
  if (extra || !signature || !authSecretMatches(payload, "bulk-import-preview-v1", signature)) throw new Error("Import preview binding is invalid.");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (parsed.expires < now || parsed.digest !== importDigest(context)) throw new Error("Import content, context or versions changed, or preview expired. Validate again.");
}
