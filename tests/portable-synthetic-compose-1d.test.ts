import {expect,it} from "vitest";
import path from "node:path";
import {syntheticCompose} from "../scripts/portable/synthetic-compose";
import {CiOperatorAdapter} from "../scripts/portable/operator-adapter";
import {ciProject} from "../scripts/portable/ci-project";
it("separates phase ownership without accepting arbitrary project identities",()=>{
 const run={GITHUB_RUN_ID:"123",GITHUB_RUN_ATTEMPT:"2"};
 expect(ciProject(run)).toBe("nalanda-ci-123-2-stack");
 expect(ciProject({...run,PORTABLE_ACCEPTANCE_PHASE:"synthetic-ON"})).toBe("nalanda-ci-123-2-qaon");
 for(const phase of ["../stack","production","qa","", "synthetic-ON-other"])expect(()=>ciProject({...run,PORTABLE_ACCEPTANCE_PHASE:phase})).toThrow("CI_PHASE_INVALID");
 expect(()=>ciProject({...run,GITHUB_RUN_ID:"other-task"})).toThrow("CI_RUN_IDENTITY_REQUIRED");
});
it("keeps production configuration immutable and binds separate read-only capability mounts",()=>{
 const service={read_only:true,environment:{NODE_ENV:"production"},secrets:[],volumes:[],depends_on:{seed:{condition:"service_completed_successfully"}}};
 const base={services:{seed:{},"web-1":structuredClone(service),"web-2":structuredClone(service)},networks:{application:{internal:true},data:{internal:true},"backup-data":{internal:true}},secrets:{}};
 const before=JSON.stringify(base),root=path.resolve("tmp/synthetic-owned");
 const result=syntheticCompose(base,root,"sha256:"+"a".repeat(64));
 expect(JSON.stringify(base)).toBe(before);
 expect(result.services["web-1"].volumes[0].source).not.toBe(result.services["web-2"].volumes[0].source);
 expect(result.services["web-1"].environment.NODE_ENV).toBe("production");
 expect(result.services["web-1"].volumes[0].read_only).toBe(true);
 expect(result.services.seed).toBeUndefined();
 expect(result.services["web-1"].depends_on).toEqual({migrator:{condition:"service_completed_successfully"}});
 base.networks.data.internal=false;expect(()=>syntheticCompose(base,root,"sha256:"+"a".repeat(64))).toThrow("PRIVATE_NETWORK_REQUIRED");
});
it.each(["backup-qa","backup-maintenance","backup-maintenance-plan","object-init","unreviewed-writer","<no value>",""])("refuses restore before reading target when %s writes are active",async service=>{
 const calls:string[][]=[];
 const manifest={project:"nalanda-ci-123-test",target:path.resolve("tmp/nonexistent-restore") } as any;
 const adapter=new CiOperatorAdapter(process.cwd(),manifest,"unused","restore",async args=>{calls.push(args);return args.includes("--format")?`aaaaaaaaaaaa:postgres\nbbbbbbbbbbbb:valkey\ncccccccccccc:${service}`:"";});
 await expect(adapter.inspectTarget(manifest,"restore")).rejects.toThrow("RESTORE_ACTIVE_WRITER_FORBIDDEN");
 expect(calls.every(c=>c[0]==="ps")).toBe(true);
});
