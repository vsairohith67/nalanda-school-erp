// Build a reviewable single-file verifier; this does not register or execute it.
import {build} from "esbuild";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
if(process.argv.length!==3)throw Error("BOOTSTRAP_OWNED_OUTPUT_REQUIRED");
const output=path.resolve(process.argv[2]);mkdirSync(output,{recursive:false,mode:0o700});
const result=await build({entryPoints:["scripts/portable/product-build-scan.ts"],bundle:true,platform:"node",format:"esm",target:"node24",write:false,metafile:true});
if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(x=>x.imports.some(i=>!i.path.startsWith("node:"))))throw Error("BOOTSTRAP_EXTERNAL_DEPENDENCY");
const bytes=result.outputFiles[0].contents,sha=b=>createHash("sha256").update(b).digest("hex");
writeFileSync(path.join(output,"product-build-scan.mjs"),bytes,{flag:"wx",mode:0o500});
writeFileSync(path.join(output,"bootstrap-manifest.json"),JSON.stringify({contract:"NALANDA_BOOTSTRAP_REVIEW_V1",bundleSha256:sha(bytes),inputs:Object.fromEntries(Object.keys(result.metafile.inputs).sort().map(p=>[p,sha(readFileSync(p))])),activation:false}),{flag:"wx",mode:0o600});
