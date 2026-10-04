import { pathToFileURL } from "node:url";
import { loadBridgeConfig } from "./config.js";
import { acquireExport, openExportScan } from "./export-source.js";
import { EXPORT_PROFILE, EXPORT_LIMITS } from "./export-profile.js";
import { safeCode } from "./agent.js";
import { lstatSync } from "node:fs";
import { compareExport } from "./export-comparison.js";

export function previewExport(configFile:string) {
  const config=loadBridgeConfig(configFile),device=config.devices.find(d=>d.profile===EXPORT_PROFILE);
  if (!device?.exportInput) throw new Error("EXPORT_CONFIG_INVALID");
  const input=device.exportInput,{files,lease}=openExportScan(input); let total=0;
  const results=[];
  for (const file of files.slice(0,EXPORT_LIMITS.filesPerCycle)) {
    try { const size=lstatSync(file).size; if(size>EXPORT_LIMITS.bytes) throw new Error("EXPORT_FILE_SIZE_INVALID"); if(total+size*2>EXPORT_LIMITS.bytesPerCycle) break; total+=size*2;
      const s=acquireExport(file,input,device.deviceId,undefined,lease,EXPORT_LIMITS.bytesPerCycle-total+size*2);
      results.push({rows:s.rows.length,validRows:s.rows.filter(r=>r.event).length,rejectedRows:s.rows.filter(r=>r.rejection).length,unknownDirectionRows:s.rows.filter(r=>r.event?.punchCode==="UNKNOWN").length,codes:[...new Set(s.rows.flatMap(r=>r.rejection?[r.rejection]:[]))]});
    } catch (e) { results.push({code:safeCode(e)}); }
  }
  return {schemaVersion:1,mode:"READ_ONLY_PREVIEW",sampleCompatibility:"INSTALLED_EXPORT_SAMPLE_NOT_VERIFIED",fileCount:files.length,inspectedFiles:results.length,unexaminedFiles:files.length-results.length,results};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [config,flag,request,outputFlag,output,...extra]=process.argv.slice(2);
    if(!config||extra.length|| (flag!==undefined && (flag!=="--compare"||!request|| (outputFlag!==undefined&&(outputFlag!=="--private-output"||!output)))))throw new Error("EXPORT_CONFIG_PATH_REQUIRED");
    process.stdout.write(JSON.stringify(flag?compareExport(config,request,output):previewExport(config))+"\n");
  }
  catch(e) { process.stderr.write(safeCode(e)+"\n"); process.exitCode=1; }
}
