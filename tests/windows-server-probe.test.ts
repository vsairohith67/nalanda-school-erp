import {it,expect,vi} from "vitest";
import {randomUUID,randomBytes} from "node:crypto";
import {parseWindowsProbe,validateWindowsProbeResult} from "../scripts/portable/windows-server-contract";
import {WindowsServerPorts,runWindowsWithServerPorts} from "../scripts/portable/windows-server-adapter";
import {readFileSync} from "node:fs";
const binding={source:"a".repeat(40),runId:"123",attempt:"1",iteration:randomUUID(),phase:"synthetic-ON" as const,databaseIdentitySha256:"b".repeat(64),publicDeviceId:randomUUID(),publicKeyHash:"c".repeat(64)};
const secret=()=>randomBytes(48).toString("base64url");
it("strict bounded operation contract rejects unknown fields, query URLs and malformed identities",()=>{
 const input={...binding,operation:"totp"};expect(parseWindowsProbe(JSON.stringify(input))).toEqual(input);
 for(const extra of [{operation:"sql"},{userId:"foreign"},{databaseUrl:"file:foreign"},{source:"bad"},{runId:123},{phase:"production"}])expect(()=>parseWindowsProbe(JSON.stringify({...input,...extra}))).toThrow();
 expect(()=>parseWindowsProbe("x".repeat(4097))).toThrow("INPUT_BOUND");expect(()=>parseWindowsProbe("{" )).toThrow("INPUT_REFUSED");
});
it("private output projection rejects extra credential fields and invented success",()=>{
 expect(()=>validateWindowsProbeResult("totp",{token:"123456",secretEnvelope:"forbidden"})).toThrow("OUTPUT_REFUSED");
 expect(()=>validateWindowsProbeResult("revoke-session",{revoked:true})).toThrow("OUTPUT_REFUSED");
 expect(()=>validateWindowsProbeResult("prepare",{password:secret()})).toThrow("OUTPUT_REFUSED");
});
it("adapter sends private stdin only, binds before and after and sanitises transport failures",async()=>{
 const invoke=vi.fn(async(raw:string)=>{expect(JSON.parse(raw)).toMatchObject({...binding,operation:"totp"});return JSON.stringify({token:"123456"});}),bind=vi.fn(),ports=new WindowsServerPorts(binding,invoke,bind,secret(),secret());
 expect(await ports.totp()).toBe("123456");expect(bind).toHaveBeenCalledTimes(2);
 invoke.mockRejectedValueOnce(Error("PRIVATE credential-bearing process diagnostic"));await expect(ports.totp()).rejects.toThrow("PRIVATE_DETAILS_WITHHELD");
 invoke.mockResolvedValueOnce(JSON.stringify({token:"123456",privateKey:"bad"}));await expect(ports.totp()).rejects.toThrow("PRIVATE_DETAILS_WITHHELD");
 await expect(ports.read(randomUUID())).rejects.toThrow("NOT_OBSERVED");await expect(ports.revokeSession(randomUUID())).rejects.toThrow("UNOBSERVED_SESSION");
 expect(()=>ports.observe("https://foreign.invalid/native/authorize")).toThrow();ports.clear();
});
it("platform rejection precedes fixture writes and discarded private ports cannot prepare again",async()=>{
 const invoke=vi.fn(),ports=new WindowsServerPorts(binding,invoke,()=>{},secret(),secret());
 await expect(runWindowsWithServerPorts({admit:async()=>{throw Error("NOT_ADMITTED");}} as any,ports,{pin:"",wrongPin:"",canaries:[]})).rejects.toThrow("NOT_ADMITTED");expect(invoke).not.toHaveBeenCalled();await expect(ports.prepare()).rejects.toThrow("PRIVATE_DETAILS_WITHHELD");expect(invoke).not.toHaveBeenCalled();
});
it("preparation failure cleans only the supplied admitted platform and reports cleanup refusal",async()=>{
 const invoke=vi.fn(async()=>{throw Error("PREPARE_FAILED");}),ports=new WindowsServerPorts(binding,invoke,()=>{},secret(),secret()),cleanup=vi.fn(async()=>{throw Error("OWNED_CLEANUP_REFUSED");});
 await expect(runWindowsWithServerPorts({admit:async()=>({...binding,origin:"https://portable-staging.localhost:8443"}),cleanup} as any,ports,{pin:"",wrongPin:"",canaries:[]})).rejects.toThrow("OWNED_CLEANUP_REFUSED");expect(cleanup).toHaveBeenCalledOnce();await expect(ports.totp()).rejects.toThrow("PRIVATE_DETAILS_WITHHELD");expect(invoke).toHaveBeenCalledOnce();
});
it("dispatcher validates Windows input before dynamically constructing its sole DB client",()=>{
 const source=readFileSync("scripts/portable/browser-probe.ts","utf8"),probe=readFileSync("scripts/portable/windows-server-probe.ts","utf8");
 expect(source.indexOf("validateWindowsProbeTarget(parseWindowsProbe(raw))")).toBeLessThan(source.indexOf('await executeWindowsProbe(input)'));
 expect(source).toContain('finally{await db.$disconnect();}');expect(source).not.toMatch(/^import .*BrowserProbe/m);
 expect(probe).not.toMatch(/^import .*device-trust/m);expect(probe).toContain('await import("../../lib/offline-sync/device-trust")');
});
