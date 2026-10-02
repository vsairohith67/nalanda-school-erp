import {generateKeyPairSync,sign,createHash} from "node:crypto";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import path from "node:path";
import os from "node:os";
import {execFileSync} from "node:child_process";
import {hashBytes} from "../../scripts/portable/artifact-handoff";
import {INPUT_CONTRACT,TOOL_NAMES,verifyInputs,type InputDocument,type InputPolicy,type SourceFile} from "../../scripts/portable/product-input-contract";
import {sourceTree,type ProductHarness} from "../../scripts/portable/product-build-scan";

/** Generated private keys and fabricated evidence are HARNESS_ONLY. Nothing
 * from this module is imported by a production source or entrypoint. */
export function fixture(options:{recipeTail?:string;badNodeLayer?:boolean;badToolArchive?:boolean}={}){
 const root=mkdtempSync(path.join(os.tmpdir(),"nalanda-HARNESS_ONLY-contract-")),workspace=path.join(root,"source");mkdirSync(workspace);
 const blobs=new Map<string,Buffer>(),pair=generateKeyPairSync("ed25519"),now=Date.now();
 const put=(value:unknown)=>{const raw=Buffer.isBuffer(value)?value:Buffer.from(typeof value==="string"?value:JSON.stringify(value));const id=hashBytes(raw);blobs.set(id,raw);return id;};
 const get=(id:string)=>{const b=blobs.get(id);if(!b)throw Error("FIXTURE_BLOB_MISSING");return b;};
 const stub=(name:string)=>put(Buffer.from(`HARNESS_ONLY inert ${name}`));
 const elf=Buffer.alloc(64);elf.set([127,69,76,70,2,1]);elf.writeUInt16LE(62,18);
 const toolHashes=Object.fromEntries(TOOL_NAMES.map(n=>[n,n==="node"?put(elf):stub(n)]));
 put(Buffer.alloc(0));
 const dbs:any={trivy:{sha256:stub("trivy-db"),file:"trivy-db/db/trivy.db",updatedAt:new Date(now).toISOString(),version:"0.70.0"},grype:{sha256:stub("grype-db"),file:"grype-db/6/vulnerability.db",updatedAt:new Date(now).toISOString(),version:"0.110.0"}};
 for(const [name,db] of Object.entries(dbs) as [string,any][]){const file=name==="trivy"?"trivy-db/db/metadata.json":"grype-db/6/import.json",meta=name==="trivy"?{Version:2,UpdatedAt:db.updatedAt,NextUpdate:new Date(now+3600000).toISOString(),DownloadedAt:db.updatedAt}:{digest:"xxh64:"+"1".repeat(16),client_version:"6.1.4"};const id=put(meta);db.files=[{file:db.file,sha256:db.sha256,bytes:get(db.sha256).length},{file,sha256:id,bytes:get(id).length}];}
 const metadata=Object.fromEntries((Object.entries(dbs) as [string,any][]).map(([n,db])=>[n,{version:db.version,databaseUpdatedAt:db.updatedAt,databaseSha256:db.sha256,ignoreUnfixed:false,severityThreshold:"HIGH",exitCode:0}]));
 const d:any={contract:INPUT_CONTRACT,classification:"HARNESS_ONLY",source:"",tree:"",architecture:"amd64",repository:"vsairohith67/nalanda-school-erp",workflow:".github/workflows/portable-staging-foundation.yml",runId:"123",attempt:"1",job:"backend-build-scan",issuedAt:now-1000,expiresAt:now+3600000,commit:"",custody:{},files:[],recipe:{},configuration:{target:"production-runtime",network:"none",syntheticTrust:null,epoch:"1234",frontend:""},images:{},tools:{},databases:dbs};
 const ident=()=>Object.fromEntries(["source","tree","architecture","repository","workflow","runId","attempt","job"].map(k=>[k,d[k]]));
 const processReports:any[]=[];
 const security=(subject:string,kind:string,node:boolean)=>{
  const trivy=put({SchemaVersion:2,...(kind==="image"?{Metadata:{ImageID:subject}}:{ArtifactName:subject,ArtifactType:"filesystem"}),Results:[{Target:"HARNESS_ONLY",Class:"os-pkgs",Type:"debian",Vulnerabilities:[]},{Target:"HARNESS_ONLY",Class:"lang-pkgs",Type:"node-pkg",Vulnerabilities:[]}]});
  const grype=put({source:kind==="image"?{target:{imageID:subject}}:{type:"file",target:{sha256:subject.slice(7)}},matches:[],ignoredMatches:[],descriptor:{version:"0.110.0"}});
  const sbom=put({spdxVersion:"SPDX-2.3",packages:[{name:node?"nodejs":"HARNESS_ONLY-tool"}]});
  const s={trivy,grype,sbom,metadata:put(metadata),processes:""};processReports.push({subject,s});return s;
 };
 const nodeEvidence=(subject:string,binary=put(elf),nodePath="bin/node")=>{const source=stub(subject+" node-source");const libs=["openssl","zlib"].map(name=>{const src=stub(subject+name);return {name,version:"HARNESS_ONLY-1",sourceSha256:src,advisories:[],evidence:put({binarySha256:binary,library:name,version:"HARNESS_ONLY-1",sourceSha256:src,unresolved:[],advisories:[]})};});return put({subject,path:nodePath,binarySha256:binary,sourceSha256:source,association:put({subject,binarySha256:binary,sourceSha256:source,buildProvenanceSha256:stub("HARNESS_ONLY-build-origin"+subject)}),inventory:put({binarySha256:binary,libraries:libs.map(l=>({name:l.name,version:l.version}))}),libraries:libs});};
 for(const name of ["runtime","builder","frontend"]){const cfg=put({os:"linux",architecture:"amd64",config:{User:"65532:65532",Labels:{"HARNESS_ONLY":name,...(name==="frontend"?{"moby.buildkit.frontend.network.none":"true"}:{})}}}),layer=put(tarBytes(name==="frontend"?{"run":Buffer.from("HARNESS_ONLY")}:{[name==="runtime"?"nodejs/bin/node":"usr/local/bin/node"]:options.badNodeLayer&&name==="runtime"?Buffer.from("unrelated"):elf})),manifest=put({schemaVersion:2,config:{digest:"sha256:"+cfg,size:get(cfg).length},layers:[{digest:"sha256:"+layer,size:get(layer).length}]}),index=put({schemaVersion:2,manifests:[{digest:"sha256:"+manifest,size:get(manifest).length,platform:{os:"linux",architecture:"amd64"}}]}),subject="sha256:"+cfg;d.images[name]={reference:(name==="frontend"?"docker/dockerfile:1.12":"harness.invalid/"+name)+"@sha256:"+index,index,manifest,config:cfg,subject,security:security(subject,"image",name!=="frontend"),node:name==="frontend"?null:nodeEvidence(subject,put(elf),name==="runtime"?"nodejs/bin/node":"usr/local/bin/node")};}
 d.configuration.frontend=d.images.frontend.reference;
 const source:Record<string,Buffer|string>={"Dockerfile":`ARG NODE_IMAGE=${d.images.builder.reference}\nARG RUNTIME_IMAGE=${d.images.runtime.reference}\nFROM scratch AS production-runtime\n${options.recipeTail??""}`,".dockerignore":".git\n","pnpm-lock.yaml":"HARNESS_ONLY\n","package.json":"{}","pnpm-workspace.yaml":"packages: []\n","config/synthetic-build-trust.json":"null","config/backend-build-scan-tools.json":"{}"};
 for(const name of ["product-scan-adapter.py","backend-build-scan.py"])source["scripts/portable/"+name]=readFileSync(path.resolve("scripts/portable",name));
 for(const [name,value] of Object.entries(source)){const raw=Buffer.from(value);mkdirSync(path.dirname(path.join(workspace,name)),{recursive:true});writeFileSync(path.join(workspace,name),raw);d.files.push({path:name,sha256:hashBytes(raw),gitBlob:createHash("sha1").update(`blob ${raw.length}\0`).update(raw).digest("hex"),mode:"100644"} satisfies SourceFile);}
 d.tree=sourceTree(d.files);const commit=Buffer.from(`tree ${d.tree}\nauthor HARNESS_ONLY <harness@example.invalid> 1 +0000\ncommitter HARNESS_ONLY <harness@example.invalid> 1 +0000\n\nHARNESS_ONLY\n`);d.commit=put(commit);d.source=createHash("sha1").update(`commit ${commit.length}\0`).update(commit).digest("hex");
 d.custody={...Object.fromEntries(["repository","workflow","source","runId","attempt","job"].map(k=>[k,d[k]])),private:true};
 d.recipe={path:"Dockerfile",sha256:d.files[0].sha256,review:put({source:d.source,tree:d.tree,recipeSha256:d.files[0].sha256,configurationSha256:hashBytes(JSON.stringify(d.configuration)),filesSha256:hashBytes(JSON.stringify(d.files))})};
 for(const name of TOOL_NAMES){const subject="sha256:"+toolHashes[name];d.tools[name]={subject,sha256:toolHashes[name],version:({trivy:"0.70.0",grype:"0.110.0",syft:"1.42.3"} as Record<string,string>)[name]??"HARNESS_ONLY-1",file:name==="runc"?"tools/buildkit/bin/buildkit-runc":["buildctl","buildkitd"].includes(name)?"tools/buildkit/bin/"+name:"tools/"+name,archive:"",security:security(subject,"tool",name==="node"),node:name==="node"?nodeEvidence(subject,toolHashes[name],"tools/node"):null};const t=d.tools[name];t.archive=put({archiveSha256:put(tarBytes({[t.file]:options.badToolArchive&&name==="buildctl"?Buffer.from("other"):get(t.sha256)})),executableSha256:t.sha256,version:t.version,path:t.file});}
 for(const {subject,s} of processReports)s.processes=put({identity:ident(),classification:"HARNESS_ONLY",subject,outcomes:Object.fromEntries(["trivy","grype","syft"].map(n=>[n,{exit:0,signal:null,timedOut:false,durationMs:1,settled:true,reportSha256:s[n==="syft"?"sbom":n],toolSha256:toolHashes[n],stdoutSha256:hashBytes(""),stderrSha256:hashBytes("")}]))});
 const policy:InputPolicy={classification:"HARNESS_ONLY",publicKey:pair.publicKey.export({type:"spki",format:"pem"}).toString(),identity:ident() as any,subjectSha256:"",now,toolPins:Object.fromEntries(TOOL_NAMES.map(n=>[n,{sha256:d.tools[n].sha256,version:d.tools[n].version,archiveSha256:JSON.parse(get(d.tools[n].archive).toString()).archiveSha256}])) as InputPolicy["toolPins"]};
 const envelope=(raw=Buffer.from(JSON.stringify(d)))=>{policy.subjectSha256=hashBytes(raw);return Buffer.from(JSON.stringify({payload:raw.toString("base64url"),signature:sign(null,raw,pair.privateKey).toString("base64url")}));};
 const verified=()=>verifyInputs(envelope(),get,policy);
 const python=execFileSync("python",["-c","import sys;print(sys.executable)"],{encoding:"utf8",windowsHide:true}).trim();
 const standin=path.join(root,"HARNESS_ONLY_child.py");writeFileSync(standin,STANDIN);
 const harness=(scenario="positive"):ProductHarness=>({classification:"HARNESS_ONLY",command:(command,work)=>{
  if((command.stage==="build"&&scenario==="startup")||(command.stage==="grype"&&scenario==="scanner-startup"))return {...command,tool:path.join(root,"missing-executable")};
  if(["build","syft","trivy","grype","trivy-db-status","grype-db-status"].includes(command.stage))return {stage:command.stage,tool:python,args:[standin,command.stage,work,d.source,d.architecture,scenario],timeoutMs:scenario==="timeout"&&command.stage==="build"?200:10000};
  return {...command,tool:python};
 }});
 return {root,workspace,d:d as InputDocument,blobs,put,get,policy,envelope,verified,harness,python,dispose:()=>rmSync(root,{recursive:true,force:true})};
}

function tarBytes(files:Record<string,Buffer>){const parts:Buffer[]=[];for(const [name,bytes] of Object.entries(files)){const h=Buffer.alloc(512);h.write(name,0,100);h.write("0000644\0",100);h.write("0000000\0",108);h.write("0000000\0",116);h.write(bytes.length.toString(8).padStart(11,"0")+"\0",124);h.write("00000000000\0",136);h.fill(32,148,156);h[156]=48;h.write("ustar\0",257);h.write("00",263);const sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,"0")+"\0 ",148);parts.push(h,bytes,Buffer.alloc((512-bytes.length%512)%512));}return Buffer.concat([...parts,Buffer.alloc(1024)]);}

const STANDIN=String.raw`# HARNESS_ONLY: finite children, no descendants or network.
import sys,json,hashlib,tarfile,io,time
from pathlib import Path
stage,raw,source,arch,scenario=sys.argv[1:]
root=Path(raw)
def enc(v):return json.dumps(v,separators=(',',':')).encode()
def sha(v):return hashlib.sha256(v).hexdigest()
def write(n,v):
 with open(root/n,'xb') as f:f.write(v if isinstance(v,bytes) else enc(v))
if stage=='trivy-db-status':
 meta=json.loads((root/'trivy-db/db/metadata.json').read_bytes());print(json.dumps({'Version':'0.70.0','VulnerabilityDB':meta}));sys.exit(0)
if stage=='grype-db-status':
 meta=json.loads((root/'trivy-db/db/metadata.json').read_bytes());print(json.dumps({'valid':True,'schemaVersion':'6.1.4','path':str(root/'grype-db/6/vulnerability.db'),'built':meta['UpdatedAt']}));sys.exit(0)
if stage=='build':
 if scenario in ('timeout','interrupt'):
  write('partial-build.log',b'HARNESS_ONLY partial');time.sleep(30)
 if scenario=='build-fail':
  write('partial-build.log',b'HARNESS_ONLY partial');sys.exit(7)
 if scenario=='disk':raise OSError(28,'HARNESS_ONLY disk full')
 if scenario=='missing-output':sys.exit(0)
 if scenario=='malformed-output':
  write('product.oci.tar',b'partial invalid tar');write('build-metadata.json',b'{');sys.exit(0)
 config=enc({'os':'linux','architecture':'arm64' if scenario=='wrong-platform' else arch,'config':{'User':'65532:65532','Labels':{'org.opencontainers.image.revision':source,'io.nalanda.artifact-purpose':'PRODUCTION_DEFAULT_OFF'}}})
 layer=b'HARNESS_ONLY inert layer bytes'
 manifest=enc({'schemaVersion':2,'config':{'digest':'sha256:'+sha(config),'size':len(config)},'layers':[{'digest':'sha256:'+sha(layer),'size':len(layer)}]})
 index=enc({'schemaVersion':2,'manifests':[{'digest':'sha256:'+sha(manifest),'size':len(manifest),'platform':{'os':'linux','architecture':arch}}]})
 files={'oci-layout':enc({'imageLayoutVersion':'1.0.0'}),'index.json':index,'blobs/sha256/'+sha(config):config,'blobs/sha256/'+sha(manifest):manifest,'blobs/sha256/'+sha(layer):layer}
 if scenario=='unrelated':files['blobs/sha256/'+sha(b'unrelated')]=b'unrelated'
 with tarfile.open(root/'product.oci.tar','w') as tar:
  for name,data in files.items():
   member=tarfile.TarInfo(name);member.size=len(data);tar.addfile(member,io.BytesIO(data))
 write('build-metadata.json',{'containerimage.config.digest':'sha256:'+sha(config),'containerimage.digest':'sha256:'+('0'*64 if scenario=='wrong-descriptor' else sha(manifest))})
 sys.exit(0)
index=json.loads((root/'product-oci/index.json').read_bytes());m=json.loads((root/'product-oci/blobs/sha256'/index['manifests'][0]['digest'][7:]).read_bytes());subject=m['config']['digest']
if stage=='syft':write('sbom.json',{'spdxVersion':'SPDX-2.3','packages':[{'name':'HARNESS_ONLY'}]})
if stage=='trivy':
 if scenario=='missing-report':sys.exit(4)
 if scenario=='malformed':write('trivy.json',b'{');sys.exit(0)
 write('trivy.json',{'SchemaVersion':2,'Metadata':{'ImageID':'sha256:'+'0'*64 if scenario=='report-subject' else subject},'Results':[{'Target':'HARNESS_ONLY','Class':'os-pkgs','Type':'debian','Vulnerabilities':[{'Severity':'HIGH'}] if scenario=='finding' else []},{'Target':'HARNESS_ONLY','Class':'lang-pkgs','Type':'node-pkg'}]})
 if scenario=='scanner-fail':sys.exit(2)
if stage=='grype':write('grype.json',{'source':{'target':{'imageID':subject}},'matches':[],'descriptor':{'version':'0.110.0'}})
`;
