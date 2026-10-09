import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

/** Syntax-valid, randomly generated values are NOT claimed reserved or owned.
 * They may exist only in a network-isolated disposable fixture environment. */
export function assertNoDefaultRoute(ipv4:string,ipv6:string) {
  const v4=ipv4.trim().split(/\r?\n/).slice(1).filter(Boolean).map(r=>r.trim().split(/\s+/));
  const v6=ipv6.trim().split(/\r?\n/).filter(Boolean).map(r=>r.trim().split(/\s+/));
  if(v4.some(r=>r[1]==="00000000"&&(parseInt(r[3],16)&1))||v6.some(r=>r[0]==="0".repeat(32)&&r[1]==="00"&&(parseInt(r[8],16)&1)))throw Error("FIXTURE_NETWORK_EGRESS_FORBIDDEN");
  if(!v4.length)throw Error("FIXTURE_NETWORK_EVIDENCE_MISSING");
}
export function privateSyntheticContact() {
  if(process.platform!=="linux"||process.env.PORTABLE_ACCEPTANCE_FIXTURE!=="synthetic-ON"||process.env.NALANDA_SYNTHETIC_STAGING!=="true")throw Error("PRIVATE_FIXTURE_CONTEXT_REQUIRED");
  assertNoDefaultRoute(readFileSync("/proc/net/route","utf8"),readFileSync("/proc/net/ipv6_route","utf8"));
  // The internal Docker network is checked again by the host admission path.
  // No DNS, provider, verification or delivery operation is performed here.
  return String(randomInt(6,10))+Array.from({length:9},()=>String(randomInt(0,10))).join("");
}
