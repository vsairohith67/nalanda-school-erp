import {it,expect,vi} from "vitest";
import {completeVaultUnlock} from "./vault-unlock";
// UNIT_OR_CONTRACT: actual cancellation helper, doubled vault/storage boundary.
it("publishes only a current completed read",async()=>{const session={lock:vi.fn(async()=>{})},publish=vi.fn();await completeVaultUnlock({open:async()=>session,read:async()=>"owned",current:()=>true,publish});expect(publish).toHaveBeenCalledWith(session,"owned");expect(session.lock).not.toHaveBeenCalled();});
it.each(["opening","reading"])("background/lock while %s prevents private publication and unloads the acquired vault",async phase=>{
 let current=true;const session={lock:vi.fn(async()=>{})},publish=vi.fn();
 await expect(completeVaultUnlock({open:async()=>{if(phase==="opening")current=false;return session;},read:async()=>{current=false;return "private";},current:()=>current,publish})).rejects.toThrow("VAULT_UNLOCK_CANCELLED");expect(publish).not.toHaveBeenCalled();expect(session.lock).toHaveBeenCalledOnce();
});
it("storage failure cannot publish and cleanup failure is not hidden",async()=>{const publish=vi.fn();await expect(completeVaultUnlock({open:async()=>({lock:async()=>{throw Error("UNLOAD_FAILED");}}),read:async()=>{throw Error("READ_FAILED");},current:()=>true,publish})).rejects.toThrow("UNLOAD_FAILED");expect(publish).not.toHaveBeenCalled();});
