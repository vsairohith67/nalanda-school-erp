import {randomBytes} from "node:crypto";
import {expect,it} from "vitest";
import {historicalIncomeKeys,mergeHistoricalIncomeKeys} from "../lib/portable-runtime/recovery-key-custody";
import {decryptMfaSecret,encryptMfaSecret,serializeMfaSecretEnvelope} from "../lib/real-user-access/crypto";
import {recoveryHash} from "../lib/portable-runtime/recovery-handoff";
import {missingOperatorScenarios,REQUIRED_OPERATOR_SCENARIOS} from "../scripts/portable/operator-acceptance";

it("retains every real operator action as required and refuses missing or failed evidence",()=>{
 const records=REQUIRED_OPERATOR_SCENARIOS.map(scenario=>({scenario,state:"PASSED"}));
 expect(missingOperatorScenarios(records)).toEqual([]);
 for(const scenario of REQUIRED_OPERATOR_SCENARIOS){
  expect(missingOperatorScenarios(records.filter(r=>r.scenario!==scenario))).toContain(scenario);
  expect(missingOperatorScenarios(records.map(r=>r.scenario===scenario?{...r,state:"FAILED"}:r))).toContain(scenario);
 }
 expect(missingOperatorScenarios([])).toEqual(REQUIRED_OPERATOR_SCENARIOS);
});

const env=(ring:unknown)=>({NODE_ENV:"test" as const,AUTH_MFA_KEYRING_JSON:JSON.stringify(ring)});
function fixture(){
 const source={active:"OLD",keys:{OLD:randomBytes(32).toString("base64"),UNRELATED:randomBytes(32).toString("base64")}};
 const target={active:"NEW",keys:{NEW:randomBytes(32).toString("base64")}};
 const backup={priorYearIncomeSupports:[{caseId:"synthetic-case",exactAmountEnvelope:serializeMfaSecretEnvelope(encryptMfaSecret("0.00","prior-year-income:synthetic-case",env(source)))}]};
 const identity={source:"a".repeat(40),runId:"123",attempt:"1",backupSha256:recoveryHash(JSON.stringify(backup))};
 const custody={contract:"NALANDA_PRIVATE_INCOME_CUSTODY_V1",...identity,...historicalIncomeKeys(backup,JSON.stringify(source))};
 return {source,target,backup,identity,custody};
}
it("preserves ciphertext and active destination auth keys while recovering exact income",()=>{
 const f=fixture(),before=JSON.stringify(f.backup),merged=mergeHistoricalIncomeKeys(JSON.stringify(f.target),JSON.stringify(f.custody),f.backup,f.identity),ring=JSON.parse(merged);
 expect(ring.active).toBe("NEW");expect(ring.keys.NEW).toBe(f.target.keys.NEW);expect(ring.keys.OLD).toBe(f.source.keys.OLD);expect(ring.keys.UNRELATED).toBeUndefined();
 expect(decryptMfaSecret(f.backup.priorYearIncomeSupports[0].exactAmountEnvelope,"prior-year-income:synthetic-case",env(ring))).toBe("0.00");
 expect(encryptMfaSecret("fresh authentication secret","session-aad",env(ring)).keyVersion).toBe("NEW");
 expect(JSON.stringify(f.backup)).toBe(before);
 expect(mergeHistoricalIncomeKeys(merged,JSON.stringify(f.custody),f.backup,f.identity)).toBe(merged);
});
it("rejects conflicting versions without changing destination keys",()=>{
 const f=fixture(),target={...f.target,keys:{...f.target.keys,OLD:randomBytes(32).toString("base64")}},before=JSON.stringify(target);
 expect(()=>mergeHistoricalIncomeKeys(before,JSON.stringify(f.custody),f.backup,f.identity)).toThrow("RECOVERY_KEY_VERSION_COLLISION");expect(JSON.stringify(target)).toBe(before);
});
it.each(["missing","wrong","unrelated","amount","case","source","attempt","hash"])("fails closed for %s custody",kind=>{
 const f=fixture(),c:any=structuredClone(f.custody);
 if(kind==="missing")c.keys={};if(kind==="wrong")c.keys.OLD=randomBytes(32).toString("base64");if(kind==="unrelated")c.keys.UNRELATED=f.source.keys.UNRELATED;
 if(kind==="amount")c.expected["synthetic-case"]="1.00";if(kind==="case")f.backup.priorYearIncomeSupports[0].caseId="different-case";
 if(kind==="source")c.source="b".repeat(40);if(kind==="attempt")c.attempt="2";if(kind==="hash")c.backupSha256="0".repeat(64);
 expect(()=>mergeHistoricalIncomeKeys(JSON.stringify(f.target),JSON.stringify(c),f.backup,f.identity)).toThrow();
});
