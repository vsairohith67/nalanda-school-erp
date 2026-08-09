import { describe,expect,it } from "vitest";
import { SUPPORT_BACKUP_KEYS,validateSupportBackupRows } from "@/lib/support-backup";
describe("SUPPORT-1A logical backup validation",()=>{
  it("accepts an empty backward-compatible support section",()=>{const result=validateSupportBackupRows({});for(const key of SUPPORT_BACKUP_KEYS)expect(result[key]).toEqual([]);});
  it("fails closed for unknown fields, broken ownership and invalid attachment storage",()=>{expect(()=>validateSupportBackupRows({supportQueues:[{id:"q",publicKey:"q-key",queueCode:"GENERAL",name:"General",status:"ACTIVE",allowedAssigneeRolesJson:"[]",confidentialityJson:"[]",version:1,createdAt:new Date(),updatedAt:new Date(),password:"bad"}]})).toThrow(/unsupported fields/);expect(()=>validateSupportBackupRows({supportRequestAttachments:[{id:"a",publicKey:"a-key",requestId:"missing",storageKey:"../bad",safeDisplayName:"Private support attachment.png",mediaType:"image/png",extension:".png",byteSize:1,sha256:"0".repeat(64),visibility:"REQUESTER_VISIBLE",intakeScope:"AUTHENTICATED",recoveryStatus:"PENDING",retentionReviewAt:new Date(),createdAt:new Date()}]})).toThrow();});
});
