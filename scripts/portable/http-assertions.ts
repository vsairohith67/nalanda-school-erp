import assert from "node:assert/strict";

export const HTTP_PRIVACY_SCENARIOS=Object.freeze([
 "H1-pdf-qr-reference-authenticated-status-exact-response-privacy",
 "H2-parent-link-revoked-stale-session-download-restored",
 "H2-role-assignment-ended-valid-preview-stale-session-and-fresh-low-role",
 "H2-exact-delegation-revoked-expired-valid-confirm",
 "H3-certificate-per-operation-actor-target-transition-idempotent-effects",
 "H3-concession-per-operation-audit-denied-income-idempotent-relief-sponsorship-refusal"
]);

// Deliberately constant failure messages: assertion diagnostics must not print
// response bodies, decoded references, cookies or private fixture values.
const equal=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b),"HTTP_CONTRACT_MISMATCH");
export function referenceToken(decoded:string){
 assert(/^urn:nalanda:certificate:[A-Za-z0-9_-]{43}$/.test(decoded),"CERTIFICATE_QR_REFERENCE_REFUSED");
 return decoded.slice("urn:nalanda:certificate:".length);
}
async function exactBody(response:Response,expected:Record<string,unknown>,sentinels:string[]){
 assert(response.headers.get("content-type")?.split(";")[0]==="application/json","HTTP_CONTENT_TYPE");
 const text=await response.text();assert(text.length<=8192,"HTTP_RESPONSE_BOUND");
 assert(sentinels.every(value=>value.length>0&&!text.includes(value)),"HTTP_PRIVATE_RESPONSE_LEAK");
 let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{throw Error("HTTP_JSON_REQUIRED");}
 assert(body&&typeof body==="object"&&!Array.isArray(body),"HTTP_OBJECT_REQUIRED");
 equal(Object.keys(body).sort(),Object.keys(expected).sort());
 for(const key of Object.keys(expected))equal(body[key],expected[key]);
}
export async function assertVerification(response:Response,expected:Record<string,unknown>,sentinels:string[]){
 assert(response.status===200,"VERIFICATION_HTTP_STATUS");
 for(const [key,value] of Object.entries({"cache-control":"private, no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}))assert(response.headers.get(key)===value,"VERIFICATION_PRIVATE_HEADERS");
 await exactBody(response,expected,sentinels);
}
export async function assertDenial(response:Response,status:401|403|404|409,body:Record<string,unknown>,sentinels:string[]=[]){
 assert(response.status===status,"AUTHORITY_DENIAL_STATUS");
 await exactBody(response,body,sentinels);
}
export async function checkedRead<T>(guard:()=>void,read:()=>Promise<T>):Promise<T>{guard();const value=await read();guard();return value;}
export function assertEventDelta<T extends {id:string}>(before:T[],after:T[],expected:Record<string,unknown>[]){
 assert(new Set(after.map(e=>e.id)).size===after.length,"AUDIT_DUPLICATE_ID");
 for(const prior of before){const current=after.find(e=>e.id===prior.id);equal(current,prior);}
 const added=after.filter(e=>!before.some(old=>old.id===e.id));assert(added.length===expected.length,"AUDIT_EVENT_CARDINALITY");
 const unmatched=[...added];
 for(const match of expected){const index=unmatched.findIndex(row=>Object.entries(match).every(([key,value])=>JSON.stringify((row as Record<string,unknown>)[key])===JSON.stringify(value)));assert(index>=0,"AUDIT_ACTOR_TARGET_ACTION_OR_STATE");unmatched.splice(index,1);}
}
export function assertSingleEffect<T extends {id:string}>(rows:T[],expected:Record<string,unknown>){assertEventDelta([],rows,[expected]);}
