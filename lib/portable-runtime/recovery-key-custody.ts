import assert from "node:assert/strict";
import { decryptMfaSecret } from "../real-user-access/crypto";
import { recoveryHash } from "./recovery-handoff";
import type { ValidatedBackup } from "../restore";

type Keyring = { active: string; keys: Record<string, string> };
function keyring(text: string): Keyring {
  assert(Buffer.byteLength(text) <= 16384, "RECOVERY_KEYRING_BOUND");
  const value = JSON.parse(text);
  assert(value && typeof value.active === "string" && /^[A-Z0-9_-]{1,32}$/.test(value.active), "RECOVERY_KEYRING_INVALID");
  assert(value.keys && typeof value.keys === "object" && !Array.isArray(value.keys), "RECOVERY_KEYRING_INVALID");
  const entries = Object.entries(value.keys);
  assert(entries.length > 0 && entries.length <= 32, "RECOVERY_KEYRING_BOUND");
  for (const [id, encoded] of entries) {
    assert(/^[A-Z0-9_-]{1,32}$/.test(id) && typeof encoded === "string" && /^[A-Za-z0-9+/]{43}=$/.test(encoded), "RECOVERY_KEYRING_INVALID");
    assert.equal(Buffer.from(encoded, "base64").length, 32, "RECOVERY_KEYRING_INVALID");
  }
  assert(Object.hasOwn(value.keys, value.active), "RECOVERY_ACTIVE_KEY_MISSING");
  return { active: value.active, keys: Object.fromEntries(entries) as Record<string,string> };
}

/** Private custody metadata is never part of a backup or public receipt. Only
 * the versions required by retained income ciphertext leave the source ring. */
export function historicalIncomeKeys(backup: Pick<ValidatedBackup,"priorYearIncomeSupports">, sourceKeyring: string) {
  const ring = keyring(sourceKeyring), keys: Record<string,string> = {}, expected: Record<string,string> = {};
  for (const row of backup.priorYearIncomeSupports) {
    if (!row.exactAmountEnvelope) continue;
    assert(typeof row.exactAmountEnvelope === "string" && typeof row.caseId === "string", "RECOVERY_INCOME_INVALID");
    const envelope = JSON.parse(row.exactAmountEnvelope);
    assert(Object.hasOwn(ring.keys, envelope.keyVersion), "RECOVERY_DATA_KEY_MISSING");
    keys[envelope.keyVersion] = ring.keys[envelope.keyVersion];
    const amount = decryptMfaSecret(row.exactAmountEnvelope, `prior-year-income:${row.caseId}`, { NODE_ENV: "test", AUTH_MFA_KEYRING_JSON: sourceKeyring });
    assert(/^\d+(\.\d{1,2})?$/.test(amount), "RECOVERY_INCOME_INVALID");
    assert(!Object.hasOwn(expected,row.caseId), "RECOVERY_INCOME_DUPLICATE");
    expected[row.caseId] = amount;
  }
  assert(Object.keys(keys).length > 0, "RECOVERY_NONEMPTY_INCOME_REQUIRED");
  return { keys, expected };
}

export function mergeHistoricalIncomeKeys(activeText: string, custodyText: string, backup: Pick<ValidatedBackup,"priorYearIncomeSupports">, identity: {source:string;runId:string;attempt:string;backupSha256:string}) {
  assert(Buffer.byteLength(custodyText) <= 32768, "RECOVERY_CUSTODY_BOUND");
  const current = keyring(activeText), custody = JSON.parse(custodyText);
  assert.equal(custody.contract,"NALANDA_PRIVATE_INCOME_CUSTODY_V1");
  for (const [key,value] of Object.entries(identity)) assert.equal(custody[key],value,"RECOVERY_CUSTODY_IDENTITY");
  const historical = keyring(JSON.stringify({active:Object.keys(custody.keys??{})[0],keys:custody.keys}));
  const verified = historicalIncomeKeys(backup,JSON.stringify(historical));
  assert.deepEqual(verified.expected,custody.expected,"RECOVERY_CUSTODY_INCOME_MISMATCH");
  assert.deepEqual(Object.keys(verified.keys).sort(),Object.keys(historical.keys).sort(),"RECOVERY_UNRELATED_KEY_TRANSFER");
  const combined = {...current.keys};
  for (const [id,key] of Object.entries(historical.keys)) {
    if (Object.hasOwn(combined,id)) assert.equal(combined[id],key,"RECOVERY_KEY_VERSION_COLLISION");
    else combined[id] = key;
  }
  const result = JSON.stringify({active:current.active,keys:combined});
  const validated = keyring(result);
  assert.equal(validated.active,current.active);
  assert.equal(recoveryHash(validated.keys[validated.active]),recoveryHash(current.keys[current.active]));
  return result;
}
