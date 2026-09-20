import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const read=(p:string)=>readFileSync(p,"utf8");
const publicPaths=new Set(["qa-producer-result.json","stack-result.json","public-evidence.json","public-index-evidence.json","oci-cleanup.json",".qa-artifacts/portable-ci/cleanup.json"]);
function audit(source:string,visibility:boolean|undefined,event:string,helpers:Record<string,string>={},visited=new Set<string>()){
 if(!["pull_request","push","workflow_dispatch"].includes(event))throw Error("EVENT_UNKNOWN");
 if(/cache-to:|cache-from:|docker\s+(?:--\S+\s+)*push|gh\s+release\s+upload|uses:\s*actions\/cache/.test(source))throw Error("UNREVIEWED_BINARY_FALLBACK");
 const chunks=source.split(/\n\s{2,8}- /);
 for(const step of chunks){
  const local=step.match(/uses:\s*(\.\/[^\s]+)/)?.[1];
  if(local){if(visited.has(local))throw Error("HELPER_CYCLE");if(!helpers[local])throw Error("UNREVIEWED_HELPER");visited.add(local);audit(helpers[local],visibility,event,helpers,visited);}
  if(!/uses:\s*actions\/upload-artifact@/.test(step))continue;
  const value=step.match(/\n\s+path:\s*([^\r\n]+)/)?.[1]?.trim();
  const privateOnly=/if:\s*\$\{\{ github\.event\.repository\.private == true \}\}/.test(step);
  if(privateOnly&&visibility!==true)continue;
  if(privateOnly&&visibility===true)continue; // Existing GitHub artifact destination, no new registry.
  if(/\n\s+path:[^\n]+\n {12}\S/.test(step))throw Error("UNREVIEWED_PUBLIC_OUTPUT");
  if(!value||!publicPaths.has(value))throw Error("UNREVIEWED_PUBLIC_OUTPUT");
 }
}
describe("portable publication exact allowlist",()=>{
 it.each([true,false,undefined].flatMap(visibility=>["pull_request","push","workflow_dispatch"].map(event=>({visibility,event}))))("validates $event visibility=$visibility independent of dormant job conditions",({visibility,event})=>{audit(read('.github/workflows/portable-staging-foundation.yml'),visibility,event);});
 it.each(["oci-layout/","oci-release/","encoded-image.txt","unexpected.json","reports/**",".next/standalone","public-evidence.json\n            oci-layout/"])("rejects extra/unreviewed output %s",output=>{const source=`jobs:\n  x:\n    steps:\n      - uses: actions/upload-artifact@pinned\n        with:\n          path: ${output}`;expect(()=>audit(source,false,"push")).toThrow();});
 it("does not inherit a caller's visibility guard into nested helper uploads",()=>{const caller="steps:\n      - uses: ./local/action\n        if: ${{ github.event.repository.private == true }}";expect(()=>audit(caller,false,"pull_request",{"./local/action":"steps:\n  - uses: actions/upload-artifact@pinned\n    with:\n      path: image.tar"})).toThrow();});
 it.each(["cache-to: type=gha","uses: actions/cache@pinned","run: docker push public/image","run: gh release upload tag image.tar"])("rejects fallback: %s",line=>expect(()=>audit(line,false,"workflow_dispatch")).toThrow());
 it("preserves existing native guards and no image cache/publication elsewhere",()=>{const native=read('.github/workflows/cross-platform-apps.yml');for(const step of native.split(/\n      - /).filter(s=>s.startsWith('uses: actions/upload-artifact@')&&/name: unsigned-/.test(s)))expect(step).toContain('if: ${{ github.event.repository.private == true }}');for(const name of readdirSync('.github/workflows'))expect(read(path.join('.github/workflows',name))).not.toMatch(/cache-to:|docker push|gh release upload/);});
 it("keeps the runtime hold and metadata transport explicitly non-deployable",()=>{expect(read('.github/workflows/portable-staging-foundation.yml')).toContain('if: ${{ false }}');expect(read('scripts/portable/public-evidence.mjs')).toContain('deployableArtifactRetained: false');expect(read('scripts/portable/qa-stack.ps1')).not.toMatch(/docker --context default build|image tag/);expect(read('scripts/portable/qa-stack.ps1')).toContain('--no-build --pull never');});
});
