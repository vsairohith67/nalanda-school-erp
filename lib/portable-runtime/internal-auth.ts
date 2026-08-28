import { timingSafeEqual } from "node:crypto";
import { readPortableSecret } from "@/lib/portable-runtime/secrets";

export function internalPortableRequestAuthorized(headers: Headers, environment: NodeJS.ProcessEnv = process.env) {
  let expected = "";
  try { expected = readPortableSecret("PORTABLE_INTERNAL_HEALTH_TOKEN", environment, { required: true }); }
  catch { return false; }
  const actual = headers.get("x-nalanda-internal-token") ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length >= 32 && expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
