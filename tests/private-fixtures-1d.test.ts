import {expect,it} from "vitest";
import {assertNoDefaultRoute,privateSyntheticContact} from "../scripts/portable/private-fixtures";
it("requires positive route evidence and rejects either family's live default route",()=>{
 const header="Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT\n";
 const local="eth0 000010AC 00000000 0001 0 0 0 0000FFFF 0 0 0\n";
 expect(()=>assertNoDefaultRoute(header+local,"")).not.toThrow();
 expect(()=>assertNoDefaultRoute(header,"")).toThrow("EVIDENCE_MISSING");
 expect(()=>assertNoDefaultRoute(header+local+"eth0 00000000 010010AC 0003 0 0 0 00000000 0 0 0","")).toThrow("EGRESS_FORBIDDEN");
 expect(()=>assertNoDefaultRoute(header+local,`${"0".repeat(32)} 00 ${"0".repeat(32)} 00 ${"0".repeat(32)} 00000001 00000000 00000000 00000001 eth0`)).toThrow("EGRESS_FORBIDDEN");
 expect(()=>privateSyntheticContact()).toThrow("PRIVATE_FIXTURE_CONTEXT_REQUIRED");
});
