import { lstatSync } from "node:fs";
import type { ConfiguredDevice, DeviceAdapter } from "./adapter.js";
import type { NormalizedEvent } from "../contracts.js";
import { EXPORT_LIMITS, EXPORT_PROFILE, digest } from "../export-profile.js";
import type { AcquiredExport } from "../export-ledger.js";
import { acquireExport, openExportScan } from "../export-source.js";
import type { EncryptedDurableQueue } from "../encrypted-queue.js";

export type ExportSourceState = "WAITING_NO_FILES" | "READING" | "STALE_SOURCE" | "PROFILE_MISMATCH" | "REVIEW_REQUIRED" | "QUEUE_HELD" | "HEALTHY_INGESTION" | "SOURCE_UNAVAILABLE";
export type ExportHealth = { state: ExportSourceState; acceptedRows: number; rejectedRows: number; reviewRows: number; replayedRows: number; deferredFiles: number; refusedFiles?:number; lastNewFileAt?: string };
export class EtimetrackLiteExportAdapter implements DeviceAdapter {
  readonly profile=EXPORT_PROFILE; readonly officialProtocolRequired=false;
  async poll():Promise<NormalizedEvent[]> { throw new Error("EXPORT_ATOMIC_QUEUE_REQUIRED"); }
  ingest(device:ConfiguredDevice,queue:EncryptedDurableQueue,transportEnabled:boolean):ExportHealth {
    const input=device.exportInput; if (!input) throw new Error("EXPORT_CONFIG_INVALID");
    const {files,lease}=openExportScan(input,queue.exportScan()),ledger=queue.exportLedger();
    const health:ExportHealth={state:"WAITING_NO_FILES",acceptedRows:0,rejectedRows:0,reviewRows:0,replayedRows:0,deferredFiles:0,lastNewFileAt:ledger.lastNewFileAt};
    if (!files.length) { if (health.lastNewFileAt && Date.now()-new Date(health.lastNewFileAt).getTime()>input.staleAfterMs) health.state="STALE_SOURCE"; return health; }
    let bytes=0,processed=0; const start=queue.exportScan()%files.length;
    for (;processed<Math.min(files.length,EXPORT_LIMITS.filesPerCycle);processed++) {
      const file=files[(start+processed)%files.length];
      let snapshot:AcquiredExport;
      try {
        const size=lstatSync(file).size; if (size>EXPORT_LIMITS.bytes) throw new Error("EXPORT_FILE_SIZE_INVALID");
        if (bytes+size*2>EXPORT_LIMITS.bytesPerCycle) break; bytes+=size*2;
        snapshot=acquireExport(file,input,device.deviceId,undefined,lease,EXPORT_LIMITS.bytesPerCycle-bytes+size*2);
      } catch (e) {
        if (e instanceof Error && ["EXPORT_SOURCE_CHANGED","EXPORT_INCOMPLETE_WRITE"].includes(e.message)) { health.deferredFiles++; continue; }
        const code=e instanceof Error && /^EXPORT_[A-Z_]+$/.test(e.message)?e.message:"EXPORT_SOURCE_UNAVAILABLE";
        queue.recordExportRefusal(digest(file),code); continue;
      }
      // Queue failure propagates: no source receipt can advance without events.
      const result=queue.commitExport(snapshot);queue.recordExportRefusal(digest(file));
      health.acceptedRows+=result.accepted; health.rejectedRows+=result.rejected; health.reviewRows+=result.review; health.replayedRows+=result.replayed;
    }
    queue.setExportScan((start+processed)%files.length);
    const committed=queue.exportLedger(); health.lastNewFileAt=committed.lastNewFileAt;
    health.refusedFiles=Object.keys(committed.refusals??{}).length;
    const historicalIssues=Object.values(committed.files).some(f=>f.rejected||f.review);
    health.state=health.refusedFiles?"PROFILE_MISMATCH":historicalIssues?"REVIEW_REQUIRED":health.deferredFiles?"READING":!health.lastNewFileAt||Date.now()-new Date(health.lastNewFileAt).getTime()>input.staleAfterMs?"STALE_SOURCE":!transportEnabled&&queue.size()>0?"QUEUE_HELD":"HEALTHY_INGESTION";
    return health;
  }
}
