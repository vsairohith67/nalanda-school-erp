import {describe,it,expect} from "vitest";
import {windowsApplicationForwardArguments,assertApplicationListeners} from "../scripts/portable/windows-forwarding";
import type {WindowsPrivateTransport} from "../scripts/portable/windows-private-transport";
describe("UNIT_OR_CONTRACT: fixed Windows application forwarding",()=>{
 it("retains host-key and identity verification and forwards only the admitted loopback proxy",()=>{
  const c={controllerPort:22,identityFile:"C:\\owned\\key",knownHosts:"C:\\owned\\known_hosts",controllerUser:"probe",controllerAddress:"10.0.0.2"} as WindowsPrivateTransport;
  const args=windowsApplicationForwardArguments(c);
  expect(args).toContain("StrictHostKeyChecking=yes");expect(args).toContain("ExitOnForwardFailure=yes");expect(args).toContain("ConnectTimeout=10");
  expect(args.filter((_,i)=>args[i-1]==="-L")).toEqual(["127.0.0.1:8443:127.0.0.1:8443","[::1]:8443:127.0.0.1:8443"]);
  expect(args).not.toContain("ClearAllForwardings=yes");expect(args).not.toContain("-R");expect(args).not.toContain("-D");expect(args.at(-1)).toBe("probe@10.0.0.2");
 });
 it("refuses public, foreign, missing, duplicate and wrong-port listeners",()=>{
  const p={pid:12,created:"synthetic",executable:"C:\\owned\\ssh.exe",sha256:"a".repeat(64),userSid:"synthetic"};
  const rows=[{address:"127.0.0.1",port:8443,pid:12},{address:"::1",port:8443,pid:12}];assertApplicationListeners(rows,p);
  for(const bad of [[],rows.slice(0,1),[...rows,rows[0]],[rows[0],{...rows[1],address:"::"}],[rows[0],{...rows[1],pid:13}],[rows[0],{...rows[1],port:5432}]])expect(()=>assertApplicationListeners(bad,p)).toThrow();
 });
});
