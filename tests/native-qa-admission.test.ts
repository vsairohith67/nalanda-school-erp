import {afterEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({operations:new Set<string>()}));
vi.mock("../lib/portable-runtime/synthetic-capability",()=>({syntheticNativeOperation:(op:string)=>state.operations.has(op),syntheticFeatureCapability:()=>null}));
import {nativeAppEnabled,nativeDataScopeEnabled,operationalNativeAppEnabled} from "../lib/native-app/feature-flag";
import {resolveNativeSession} from "../lib/native-app/auth";
afterEach(()=>state.operations.clear());
it("operation-specific availability does not enable general offline flags or posting",async()=>{
 const env:NodeJS.ProcessEnv={NODE_ENV:"production"};expect(nativeAppEnabled(env)).toBe(false);
 state.operations.add("AUTH");state.operations.add("CONTEXT");state.operations.add("REFERENCE");
 expect(nativeAppEnabled(env)).toBe(true);expect(operationalNativeAppEnabled(env)).toBe(false);
 expect(nativeDataScopeEnabled("offline:context",env)).toBe(true);expect(nativeDataScopeEnabled("offline:reference",env)).toBe(true);
 for(const scope of ["offline:sync","offline:own-conflicts"] as const){expect(nativeDataScopeEnabled(scope,env)).toBe(false);await expect(resolveNativeSession(new Request("https://synthetic.invalid"),scope)).rejects.toMatchObject({code:"NATIVE_APP_UNAVAILABLE"});}
 // Availability still requires the actual native credentials, not a signed QA label.
 await expect(resolveNativeSession(new Request("https://synthetic.invalid"),"offline:reference")).rejects.toMatchObject({code:"NATIVE_SESSION_REQUIRED",status:400});
});
