import {afterEach,describe,expect,it} from "vitest";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,chmodSync} from "node:fs";
import path from "node:path";
import os from "node:os";
import {produceQaArtifact,type ProducerPorts,type ProducerCommand} from "../scripts/portable/qa-artifact-producer";
import {cleanupProducerRoot,createProducerRoot,prepareSigningRoot,producerIdentity,producerPaths,readSigningRoot,type ProducerIdentity} from "../scripts/portable/synthetic-build-lifecycle";
import {ARTIFACT_CONTRACT,EVIDENCE_NAMES,hashBytes,verifyArtifactEvidence,assertRuntimeAdmission,type ArtifactContext,type EvidenceFiles} from "../scripts/portable/artifact-handoff";
import {cleanupProducerResources,producerProcess} from "../scripts/portable/qa-artifact-producer-cli";
import {buildToolPins,validateToolEntries,verifyToolArchive,prepareBuildTools} from "../scripts/portable/qa-build-tools";
import {rootlessBuildCommand,assertEmptyBuildCache,cleanupRootlessBuild} from "../scripts/portable/qa-rootless-build";

const roots:string[]=[];
const workspace=()=>{const root=mkdtempSync(path.join(os.tmpdir(),"nalanda-qa-producer-contract-"));roots.push(root);return root;};
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});}); // freshly created harness roots only
const base:ProducerIdentity={source:"a".repeat(40),runId:"321",attempt:"2",architecture:"amd64"};
const baseImages=["fixture-build@sha256:"+"a".repeat(64),"fixture-runtime@sha256:"+"b".repeat(64)];
const inputs={Dockerfile:"c".repeat(64),"pnpm-lock.yaml":"d".repeat(64),"package.json":"e".repeat(64)};
function evidence(id:ProducerIdentity,config:unknown,extra:Record<string,string>={}){
 const files:EvidenceFiles={};const put=(name:string,value:unknown)=>files[name]=Buffer.from(JSON.stringify(value));
 put("config.json",config);const image="sha256:"+hashBytes(files["config.json"]);
 put("manifest.json",{schemaVersion:2,config:{digest:image,size:files["config.json"].length},layers:[{digest:"sha256:"+"f".repeat(64),size:5}]});
 put("index.json",{schemaVersion:2,manifests:[{digest:"sha256:"+hashBytes(files["manifest.json"]),size:files["manifest.json"].length}]});
 put("sbom.json",{spdxVersion:"SPDX-2.3",packages:[{name:"HARNESS_FIXTURE_ONLY"}]});
 put("trivy.json",{SchemaVersion:2,Metadata:{ImageID:image},Results:[{Class:"os-pkgs",Type:"fixture-os",Target:"HARNESS_FIXTURE_ONLY"},{Class:"lang-pkgs",Type:"node-pkg",Target:"fixture-app"}]});
 put("grype.json",{source:{target:{imageID:image}},descriptor:{version:"harness-1"},matches:[]});
 const scanner={version:"harness-1",databaseUpdatedAt:new Date().toISOString(),databaseSha256:"a".repeat(64),ignoreUnfixed:false,severityThreshold:"HIGH",exitCode:0};
 put("scanner-metadata.json",{trivy:scanner,grype:scanner});put("native.json",{architecture:id.architecture,imageConfigDigest:image,result:"PASSED"});
 put("provenance.json",{contract:ARTIFACT_CONTRACT,classification:"HARNESS_FIXTURE_ONLY",...id,generatedAt:new Date().toISOString(),inputs:{...inputs,...extra},baseImages,scannerVersions:{trivy:"harness-1"},receipts:EVIDENCE_NAMES.filter(n=>n!=="provenance.json").map(name=>({name,sha256:hashBytes(files[name])}))});
 const context:ArtifactContext={...id,now:Date.now(),inputs:{...inputs,...extra},baseImages,...(extra["synthetic-build-trust.json"]?{purpose:"SYNTHETIC_ACCEPTANCE_ONLY" as const}:{})};
 return {files,context,image};
}
function harness(id=base,options:{fail?:string;malformed?:boolean;high?:boolean;stale?:boolean;substitute?:boolean;changed?:boolean;missing?:boolean;cleanupFailure?:boolean;abort?:AbortController}={}){
 const root=workspace(),paths=producerPaths(root,id),commands:ProducerCommand[]=[],events:string[]=[];
 let config:any,qa:ReturnType<typeof evidence>,privateKey="",sourceChanged=false;
 const production=evidence(id,{architecture:id.architecture,os:"linux",config:{User:"65532:65532",Labels:{"org.opencontainers.image.revision":id.source,"io.nalanda.artifact-purpose":"PRODUCTION_DEFAULT_OFF"}}});
 const ports:ProducerPorts={classification:"HARNESS_FIXTURE_ONLY",signal:options.abort?.signal,
  verifySource:async()=>({fingerprint:(sourceChanged?"b":"a").repeat(64),epoch:"12345"}),
  admitProduction:async()=>{events.push("production-admission");if(options.fail==="production-admission")throw Error("REFUSED");return verifyArtifactEvidence(production.files,production.context);},
  run:async command=>{
   commands.push(command);events.push(command.stage);
   if(command.stage==="qa-build-tools"){if(options.fail===command.stage)throw Error("HARNESS_TOOL_PREPARATION_FAILED");return "";}
   expect(existsSync(path.join(paths.signing,"private-key.pem"))).toBe(true);
   privateKey=readFileSync(path.join(paths.signing,"private-key.pem"),"utf8");
   expect(JSON.stringify(command)).not.toContain(privateKey);expect(JSON.stringify(command)).not.toContain("BEGIN PRIVATE KEY");
   if(options.fail===command.stage)throw Error("HARNESS_EXTERNAL_COMMAND_FAILED private-output-must-not-escape");
   if(command.stage==="extract"&&!options.missing){mkdirSync(path.join(paths.work,"context/config"));writeFileSync(path.join(paths.work,"context/config/synthetic-build-trust.json"),"null");}
   if(command.stage==="build"){
    const signing=readSigningRoot(root,id);
    expect(command.args).toContain("target=synthetic-qa");expect(command.args).toContain(`platform=linux/${id.architecture}`);expect(command.args).toContain(`build-arg:SOURCE_COMMIT=${id.source}`);
    expect(JSON.parse(Buffer.from(command.args.find(a=>a.startsWith("build-arg:SYNTHETIC_BUILD_TRUST="))!.split("=")[1],"base64url").toString())).toEqual(signing.trust);
    expect(command.args).toContain(`context=${path.join(paths.work,"context")}`);expect(paths.signing.startsWith(path.join(paths.work,"context")+path.sep)).toBe(false);
    config={architecture:id.architecture,os:"linux",config:{User:"65532:65532",Labels:{"org.opencontainers.image.revision":id.source,"io.nalanda.artifact-purpose":"SYNTHETIC_ACCEPTANCE_ONLY","io.nalanda.synthetic-trust-sha256":signing.sha256,"io.nalanda.qa-project":paths.project,"io.nalanda.qa-run":id.runId,"io.nalanda.qa-attempt":id.attempt}}};
    qa=evidence(id,config,{"synthetic-build-trust.json":signing.sha256});writeFileSync(path.join(paths.work,"image.id"),qa.image);
    if(options.changed)sourceChanged=true;
   }
   if(command.stage==="inspect")return JSON.stringify([{Id:qa.image,Architecture:id.architecture,Os:"linux",Config:config.config}]);
   const outputs:Record<string,[string,string]>={sbom:["sbom.spdx.json","sbom.json"],trivy:["trivy-results.json","trivy.json"],grype:["grype-results.json","grype.json"],"scanner-metadata":["scanner-metadata.json","scanner-metadata.json"]};
   if(outputs[command.stage]){const [file,key]=outputs[command.stage];let bytes=qa.files[key];if(options.malformed&&command.stage==="grype")bytes=Buffer.from("{");if(options.high&&command.stage==="trivy"){const raw=JSON.parse(bytes.toString());raw.Results[0].Vulnerabilities=[{Severity:"HIGH"}];bytes=Buffer.from(JSON.stringify(raw));}writeFileSync(path.join(paths.work,file),bytes);}
   if(command.stage==="native-probe")return JSON.stringify({nativeLoad:"PASSED",platform:"linux",architecture:id.architecture==="amd64"?"x64":"arm64",emulationUsed:false});
   if(command.stage==="capture-artifact-evidence"){
    mkdirSync(path.join(paths.work,"evidence"));
    if(options.stale){const p=JSON.parse(qa.files["provenance.json"].toString());p.generatedAt="2020-01-01";qa.files["provenance.json"]=Buffer.from(JSON.stringify(p));}
    if(options.substitute)qa.files["config.json"]=Buffer.from("{}");
    for(const [name,bytes] of Object.entries(qa.files))writeFileSync(path.join(paths.work,"evidence",name),bytes);
   }
   if(options.abort&&command.stage==="oci")options.abort.abort();
   return "";
  },
  admitQa:async(evidenceRoot,trust)=>{events.push("admission");expect(evidenceRoot).toBe(path.join(paths.work,"evidence"));expect(hashBytes(trust)).toBe(qa.context.inputs["synthetic-build-trust.json"]);if(options.fail==="admission")throw Error("DENIED");return verifyArtifactEvidence(Object.fromEntries(EVIDENCE_NAMES.map(name=>[name,readFileSync(path.join(evidenceRoot,name))])),{...qa.context,now:Date.now()});},
  cleanupResources:async()=>{events.push("cleanup");expect(existsSync(paths.work)).toBe(true);if(options.cleanupFailure)throw Error("HARNESS_RESIDUE");}
 };
 return {root,paths,ports,commands,events,production,getPrivateKey:()=>privateKey};
}
describe("same orchestration; simulated external commands, never runtime qualification",()=>{
 it.each(["amd64","arm64"] as const)("binds command order, all identities and private cleanup (%s)",async architecture=>{
  const h=harness({...base,architecture});const result=await produceQaArtifact(h.root,{...base,architecture},h.ports);
  expect(result.complete).toBe(true);expect(result.classification).toBe("HARNESS_FIXTURE_ONLY");expect(result.productionAcceptance).toBe(false);
  expect(h.events).toEqual(["production-admission","qa-build-tools","archive","extract","build","load","inspect","sbom","trivy","grype","scanner-metadata","native-probe","oci","capture-artifact-evidence","admission","browser-install","qa-synthetic-stack","cleanup"]);
  expect(existsSync(h.paths.signing)).toBe(false);expect(existsSync(h.paths.work)).toBe(false);
  const image=result.imageConfigDigest!;for(const stage of ["sbom","trivy","grype","native-probe","oci"]){expect(h.commands.find(c=>c.stage===stage)!.args.some(a=>a.includes(image))).toBe(true);}
  const capture=h.commands.find(c=>c.stage==="capture-artifact-evidence")!;expect(capture.args.slice(-2)).toEqual(["--synthetic",path.join(h.paths.signing,"trust.json")]);
  expect(h.commands.find(c=>c.stage==="qa-synthetic-stack")!.env!.PLAYWRIGHT_BROWSERS_PATH).toBe(path.join(h.paths.work,"browser"));
  expect(Object.keys(result).sort()).toEqual(["contract","classification","source","runId","attempt","architecture","productionAcceptance","artifactProducedAndAdmitted","callerCompleted","cleanupComplete","failure","cleanupRefusals","completedStages","imageConfigDigest","complete"].sort());
  expect(JSON.stringify(result)).not.toContain(h.getPrivateKey());expect(JSON.stringify(result)).not.toContain(h.root);
  expect(()=>assertRuntimeAdmission(verifyArtifactEvidence(h.production.files,h.production.context))).toThrow("HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME");
 });
 it.each(["qa-build-tools","archive","extract","build","load","inspect","sbom","trivy","grype","scanner-metadata","native-probe","oci","capture-artifact-evidence","admission","browser-install","qa-synthetic-stack"])("cleans reachable private roots on %s failure; does not continue",async fail=>{
  const h=harness(base,{fail});const result=await produceQaArtifact(h.root,base,h.ports);
  expect(result.complete).toBe(false);expect(result.failure).toContain(fail.toUpperCase().replaceAll("-","_"));expect(result.cleanupComplete).toBe(true);
  expect(result.artifactProducedAndAdmitted).toBe(["browser-install","qa-synthetic-stack"].includes(fail));
  if(fail!=="qa-synthetic-stack")expect(h.commands.some(c=>c.stage==="qa-synthetic-stack")).toBe(false);
  expect(existsSync(h.paths.signing)).toBe(false);expect(existsSync(h.paths.work)).toBe(false);expect(JSON.stringify(result)).not.toContain("private-output");
 });
 it.each(["malformed","high","stale","substitute","changed","missing"] as const)("rejects %s evidence/inputs before caller execution",async mode=>{
  const h=harness(base,{[mode]:true});const result=await produceQaArtifact(h.root,base,h.ports);expect(result.complete).toBe(false);expect(result.cleanupComplete).toBe(true);
  expect(h.commands.some(c=>c.stage==="qa-synthetic-stack")).toBe(false);if(mode==="high"||mode==="malformed")expect(h.commands.some(c=>c.stage==="native-probe")).toBe(false);
 });
 it("production admission denial precedes filesystem and all process actions",async()=>{
  const h=harness(base,{fail:"production-admission"});await expect(produceQaArtifact(h.root,base,h.ports)).rejects.toThrow("REFUSED");expect(h.commands).toEqual([]);expect(existsSync(h.paths.work)).toBe(false);expect(existsSync(h.paths.signing)).toBe(false);
 });
 it("real admission cannot accept a harness fixture even inside producer",async()=>{
  const h=harness();h.ports.admitProduction=async()=>{const receipt=verifyArtifactEvidence(h.production.files,h.production.context);assertRuntimeAdmission(receipt);return receipt;};
  await expect(produceQaArtifact(h.root,base,h.ports)).rejects.toThrow("HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME");expect(existsSync(h.paths.signing)).toBe(false);
 });
 it("catchable cancellation stops later actions and cleans both roots",async()=>{
  const h=harness(base,{abort:new AbortController()});const result=await produceQaArtifact(h.root,base,h.ports);expect(result.complete).toBe(false);expect(result.cleanupComplete).toBe(true);expect(h.events).not.toContain("admission");expect(existsSync(h.paths.signing)).toBe(false);
 });
 it("resource-cleanup failure still removes signer and retains owned reconciliation root",async()=>{
  const h=harness(base,{cleanupFailure:true});const result=await produceQaArtifact(h.root,base,h.ports);expect(result.complete).toBe(false);expect(result.cleanupComplete).toBe(false);expect(existsSync(h.paths.signing)).toBe(false);expect(existsSync(h.paths.work)).toBe(true);expect(result.cleanupRefusals).toContain("WORK_ROOT_RETAINED_FOR_RECONCILIATION");cleanupProducerRoot(h.root,base,"work");
 });
 it("existing signing root is never adopted or deleted during preparation",async()=>{
  const h=harness();mkdirSync(h.paths.signing,{recursive:true});writeFileSync(path.join(h.paths.signing,"foreign"),"preserve");const result=await produceQaArtifact(h.root,base,h.ports);expect(result.complete).toBe(false);expect(readFileSync(path.join(h.paths.signing,"foreign"),"utf8")).toBe("preserve");expect(existsSync(h.paths.work)).toBe(false);expect(h.commands.map(c=>c.stage)).toEqual(["qa-build-tools"]);
 });
});
describe("real Ed25519 private filesystem lifecycle",()=>{
 it("binds identity and target, refuses repeated/stale preparation, verifies removal",()=>{
  const root=workspace();createProducerRoot(root,base,"signing");const first=prepareSigningRoot(root,base);expect(readSigningRoot(root,base).trust).toEqual(first);
  expect(()=>prepareSigningRoot(root,base)).toThrow();expect(()=>readSigningRoot(root,{...base,source:"b".repeat(40)})).toThrow("OWNER_MISMATCH");expect(()=>cleanupProducerRoot(root,{...base,architecture:"arm64"},"signing")).toThrow("OWNER_MISMATCH");
  expect(cleanupProducerRoot(root,base,"signing")).toBe("REMOVED");expect(cleanupProducerRoot(root,base,"signing")).toBe("ABSENT");
 });
 it("rejects mismatched public trust/private key and refuses foreign cleanup entries",()=>{
  const root=workspace();const signing=createProducerRoot(root,base,"signing");prepareSigningRoot(root,base);const trust=JSON.parse(readFileSync(path.join(signing,"trust.json"),"utf8"));trust.source="b".repeat(40);chmodSync(path.join(signing,"trust.json"),0o600);writeFileSync(path.join(signing,"trust.json"),JSON.stringify(trust));expect(()=>readSigningRoot(root,base)).toThrow("TRUST_MISMATCH");
  writeFileSync(path.join(signing,"foreign"),"retain");expect(()=>cleanupProducerRoot(root,base,"signing")).toThrow("FOREIGN_FILE");expect(existsSync(path.join(signing,"private-key.pem"))).toBe(true);
 });
 it("refuses symlinked roots and descendants without touching their targets",()=>{
  const root=workspace(),foreign=workspace(),paths=producerPaths(root,base);mkdirSync(paths.parent,{recursive:true});symlinkSync(foreign,paths.signing,process.platform==="win32"?"junction":"dir");
  expect(()=>cleanupProducerRoot(root,base,"signing")).toThrow();expect(existsSync(foreign)).toBe(true);rmSync(paths.signing);createProducerRoot(root,base,"signing");symlinkSync(foreign,path.join(paths.signing,"linked"),process.platform==="win32"?"junction":"dir");expect(()=>cleanupProducerRoot(root,base,"signing")).toThrow("SYMLINK");expect(existsSync(foreign)).toBe(true);
 });
 it("rejects malformed source/run/attempt/architecture inputs",()=>{
  const env={...process.env,EXPECTED_SHA:base.source,GITHUB_RUN_ID:base.runId,GITHUB_RUN_ATTEMPT:base.attempt,TARGET_ARCHITECTURE:base.architecture};expect(producerIdentity(env)).toEqual(base);
  for(const change of [{EXPECTED_SHA:"HEAD"},{GITHUB_RUN_ID:"../other"},{GITHUB_RUN_ATTEMPT:""},{TARGET_ARCHITECTURE:"x64"}])expect(()=>producerIdentity({...env,...change})).toThrow("IDENTITY_INVALID");
 });
 it("rejects a copied owner manifest in another workspace",()=>{
  const first=workspace(),second=workspace(),source=createProducerRoot(first,base,"signing"),destination=producerPaths(second,base).signing;
  mkdirSync(destination,{recursive:true});writeFileSync(path.join(destination,"owner.json"),readFileSync(path.join(source,"owner.json")));
  expect(()=>cleanupProducerRoot(second,base,"signing")).toThrow("OWNER_MISMATCH");expect(existsSync(destination)).toBe(true);
 });
});

describe("real process adapter and owned runtime cleanup, no application execution",()=>{
 it("times out a harmless process; POSIX also kills a surviving descendant before cleanup",async()=>{
  const root=workspace(),pidFile=path.join(root,"descendant.pid");
  const script=process.platform==="win32"?"setInterval(()=>{},1000)":`const {spawn}=require('node:child_process');const fs=require('node:fs');const p=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(p.pid));process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`;
  await expect(producerProcess({stage:"contract-timeout",tool:process.execPath,args:["-e",script,pidFile],timeoutMs:500},root)).rejects.toThrow("QA_PROCESS_FAILED_OR_CANCELLED");
  if(process.platform!=="win32"){
   const pid=Number(readFileSync(pidFile,"utf8"));let active=true;
   for(let i=0;i<50;i++){try{const stat=readFileSync(`/proc/${pid}/stat`,"utf8");active=stat.slice(stat.lastIndexOf(")")+2).split(" ")[0]!=="Z";}catch{active=false;}if(!active)break;await new Promise(r=>setTimeout(r,20));}
   expect(active).toBe(false);
  }
 });
 it("returns bounded stdout and sanitizes failed child output",async()=>{
  const root=workspace();expect(await producerProcess({stage:"contract-process",tool:process.execPath,args:["-e","process.stdout.write('HARNESS_FIXTURE_ONLY')"]},root)).toBe("HARNESS_FIXTURE_ONLY");
  await expect(producerProcess({stage:"contract-failure",tool:process.execPath,args:["-e","process.stderr.write('PRIVATE_SENTINEL');process.exit(3)"]},root)).rejects.toThrow("QA_PROCESS_FAILED_OR_CANCELLED");
 });
 it("terminates a harmless child on cancellation and settles before cleanup",async()=>{
  const controller=new AbortController(),root=workspace();const run=producerProcess({stage:"contract-cancel",tool:process.execPath,args:["-e","setInterval(()=>{},1000)"]},root,controller.signal);
  setTimeout(()=>controller.abort(),100);await expect(run).rejects.toThrow("QA_PROCESS_FAILED_OR_CANCELLED");
 });
 it.each(["owned","foreign-probe","foreign-image"])("checks exact resource identities before removal: %s",async mode=>{
  const root=workspace(),paths=producerPaths(root,base);createProducerRoot(root,base,"work");
  const calls:ProducerCommand[]=[],image="sha256:"+"b".repeat(64),probe="c".repeat(64);let probeRemoved=false,imageRemoved=false;
  const execute:typeof producerProcess=async command=>{
   calls.push(command);
   if(command.stage==="probe-list"||command.stage==="probe-readback")return probeRemoved?"":probe;
   if(command.stage==="probe-inspect")return JSON.stringify([{Id:probe,Name:`/${paths.project}-amd64-native`,Config:{Labels:{"nalanda.ci.run":mode==="foreign-probe"?"other":base.runId,"nalanda.ci.attempt":base.attempt,"nalanda.ci.project":paths.project}}}]);
   if(command.stage==="probe-remove"){probeRemoved=true;expect(command.args.slice(-2)).toEqual(["-f",probe]);}
   if(command.stage==="image-list"||command.stage==="image-readback")return imageRemoved?"":image;
   if(command.stage==="image-inspect")return JSON.stringify([{Id:image,Architecture:base.architecture,Config:{Labels:{"org.opencontainers.image.revision":mode==="foreign-image"?"f".repeat(40):base.source,"io.nalanda.artifact-purpose":"SYNTHETIC_ACCEPTANCE_ONLY","io.nalanda.qa-project":paths.project,"io.nalanda.qa-run":base.runId,"io.nalanda.qa-attempt":base.attempt}}}]);
   if(command.stage==="image-remove"){imageRemoved=true;expect(command.args.slice(-2)).toEqual(["rm",image]);expect(command.args).not.toContain("-f");}
   return "";
  };
  if(mode==="owned")await expect(cleanupProducerResources(root,base,execute)).resolves.toBeUndefined();else await expect(cleanupProducerResources(root,base,execute)).rejects.toThrow("CLEANUP_REFUSED");
  expect(probeRemoved).toBe(mode!=="foreign-probe");expect(imageRemoved).toBe(mode!=="foreign-image");expect(JSON.stringify(calls)).not.toContain("prune");
 });
 it("refuses foreign filesystem ownership before executing resource cleanup",async()=>{
  const root=workspace();createProducerRoot(root,{...base,source:"b".repeat(40)},"work");let called=false;
  await expect(cleanupProducerResources(root,base,async()=>{called=true;return "";})).rejects.toThrow("OWNER_MISMATCH");expect(called).toBe(false);
 });
});

describe("rootless vendor tools and isolated build command contracts",()=>{
 it("honors tool preparation cancellation before creating inputs or downloading",async()=>{
  const root=workspace(),controller=new AbortController();controller.abort();await expect(prepareBuildTools(root,base,controller.signal)).rejects.toThrow("PREPARATION_CANCELLED");expect(existsSync(producerPaths(root,base).work)).toBe(false);
 });
 it("refuses ambiguous interrupted daemon startup before touching any owned root",async()=>{
  const root=workspace(),work=createProducerRoot(root,base,"work");writeFileSync(path.join(work,"buildkit-starting.json"),JSON.stringify(base));
  await expect(cleanupRootlessBuild(root,base)).rejects.toThrow("STARTUP_UNRECONCILED");expect(existsSync(work)).toBe(true);
 });
 it("parses BuildKit disk-usage slices and refuses malformed/nonempty cache results",()=>{
  for(const empty of ["[]","null"]){expect(()=>assertEmptyBuildCache(empty)).not.toThrow();}
  for(const residue of ["", "{}", "[{\"ID\":\"remaining\"}]", "false"]){expect(()=>assertEmptyBuildCache(residue)).toThrow();}
 });
 it.each(["amd64","arm64"] as const)("pins official archives and isolates every build input/cache (%s)",architecture=>{
  const identity={...base,architecture},root=workspace();mkdirSync(path.join(root,"config"));writeFileSync(path.join(root,"config/qa-build-tools.json"),readFileSync("config/qa-build-tools.json"));
  const {selected}=buildToolPins(root,identity);expect(selected.buildkit.url).toContain(`linux-${architecture}`);expect(selected.buildkit.sha256).toMatch(/^[a-f0-9]{64}$/);
  const cmd=rootlessBuildCommand(path.join(root,"owned"),identity,"123","PUBLIC_TRUST_ONLY","a".repeat(64));
  expect(cmd.args).toContain(`unix://${path.join(root,"owned/buildkit.sock")}`);expect(cmd.args).toContain(`type=docker,dest=${path.join(root,"owned/image.tar")}`);expect(cmd.args).toContain("target=synthetic-qa");
  expect(cmd.args.join(" ")).not.toMatch(/--privileged|--no-process-sandbox|cache-to|cache-from|type=registry|--push|PRIVATE KEY/);
 });
 it("rejects changed archives, traversal and links before tool execution",()=>{
  const bytes=Buffer.alloc(1024,7);expect(()=>verifyToolArchive(bytes,hashBytes(bytes))).not.toThrow();expect(()=>verifyToolArchive(bytes,"a".repeat(64))).toThrow("CHECKSUM_MISMATCH");
  expect(()=>validateToolEntries("bin/\nbin/buildctl\n","drwxr-xr-x bin/\n-rwxr-xr-x bin/buildctl\n")).not.toThrow();
  for(const names of ["../outside","bin/../outside","/absolute","bin/a/b",".."]){expect(()=>validateToolEntries(names,"-rwxr-xr-x file")).toThrow("ARCHIVE_UNSAFE");}
  expect(()=>validateToolEntries("bin/buildctl","lrwxr-xr-x link -> elsewhere")).toThrow("ARCHIVE_UNSAFE");
 });
 it("rejects mutable/nonvendor tool references",()=>{
  const root=workspace();mkdirSync(path.join(root,"config"));const pins=JSON.parse(readFileSync("config/qa-build-tools.json","utf8"));pins.amd64.buildkit.url="https://example.invalid/latest.tar.gz";writeFileSync(path.join(root,"config/qa-build-tools.json"),JSON.stringify(pins));expect(()=>buildToolPins(root,base)).toThrow("PINS_INVALID");
 });
});
