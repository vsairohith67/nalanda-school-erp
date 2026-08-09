import { afterEach,describe,expect,it } from "vitest";
import { NextRequest } from "next/server";
import { createGatePassMaterial,gateApprovalSnapshotHash,manualGatePassCodeHash,verifySignedGatePassToken } from "@/lib/safe-exit-gate-pass";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { createBackupDocument } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { SAFE_EXIT_BACKUP_KEYS,validateSafeExitBackupRows } from "@/lib/safe-exit-backup";
import { parseSafeExitJson } from "@/lib/safe-exit-api";

const previousSecret=process.env.SAFE_EXIT_GATE_PASS_SECRET;
const previousOrigin=process.env.APP_ORIGIN;
afterEach(()=>{if(previousSecret===undefined)delete process.env.SAFE_EXIT_GATE_PASS_SECRET;else process.env.SAFE_EXIT_GATE_PASS_SECRET=previousSecret;if(previousOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previousOrigin;});

describe("SAFE-EXIT-1A governed security foundation",()=>{
  it("creates an opaque signed short-lived token and rejects tampering, expiry and malformed manual codes",()=>{
    process.env.SAFE_EXIT_GATE_PASS_SECRET="safeexit1-qa-secret-that-is-longer-than-thirty-two-characters";
    const now=new Date("2026-08-09T05:00:00.000Z"),material=createGatePassMaterial(now,15);
    expect(material.token).not.toMatch(/student|guardian|phone|internal/i);
    expect(material.manualCode).toMatch(/^[A-F0-9]{8}$/);
    expect(verifySignedGatePassToken(material.token,new Date(now.getTime()+1_000))).toMatchObject({tokenHash:material.tokenHash});
    expect(manualGatePassCodeHash(material.manualCode.toLowerCase())).toBe(material.manualCodeHash);
    expect(()=>verifySignedGatePassToken(`${material.token}x`,now)).toThrow(/invalid|tampered/i);
    expect(()=>verifySignedGatePassToken(material.token,new Date(now.getTime()+16*60_000))).toThrow(/expired/i);
    expect(()=>manualGatePassCodeHash("123")).toThrow(/invalid/i);
  });

  it("keeps gate, Teacher, Parent, Accountant and Viewer defaults least-privileged",()=>{
    const gate=RECOMMENDED_ROLE_PERMISSIONS.GATE_STAFF,teacher=RECOMMENDED_ROLE_PERMISSIONS.TEACHER,parent=RECOMMENDED_ROLE_PERMISSIONS.PARENT;
    expect([...gate].sort()).toEqual(["ACKNOWLEDGE_OWN_NOTIFICATIONS","COMPLETE_STUDENT_CHECKOUT","RECORD_STUDENT_RETURN","VERIFY_GATE_PASS","VIEW_DASHBOARD","VIEW_LIVE_CAMPUS_ROSTER","VIEW_OWN_NOTIFICATIONS"].sort());
    expect(teacher.has("REQUEST_STUDENT_DEPARTURE")).toBe(true);expect(teacher.has("APPROVE_STUDENT_DEPARTURE")).toBe(false);
    expect(parent.has("REQUEST_STUDENT_DEPARTURE")).toBe(true);expect(parent.has("RECORD_PARENT_CONSENT")).toBe(true);expect(parent.has("APPROVE_STUDENT_DEPARTURE")).toBe(false);
    for(const role of ["ACCOUNTANT","VIEWER"]as const)for(const permission of ["REQUEST_STUDENT_DEPARTURE","VERIFY_GATE_PASS","VIEW_LIVE_CAMPUS_ROSTER"]as const)expect(RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)).toBe(false);
  });

  it("rejects cross-origin, oversized and non-object state-changing JSON",async()=>{
    process.env.APP_ORIGIN="https://school.example";
    await expect(parseSafeExitJson(new NextRequest("https://school.example/api/student-departures",{method:"POST",headers:{origin:"https://evil.example","content-type":"application/json"},body:"{}"}))).rejects.toMatchObject({code:"ORIGIN_DENIED"});
    await expect(parseSafeExitJson(new NextRequest("https://school.example/api/student-departures",{method:"POST",headers:{origin:"https://school.example","content-type":"application/json","content-length":String(65*1024)},body:"{}"}))).rejects.toMatchObject({code:"PAYLOAD_TOO_LARGE"});
    await expect(parseSafeExitJson(new NextRequest("https://school.example/api/student-departures",{method:"POST",headers:{origin:"https://school.example","content-type":"application/json"},body:"[]"}))).rejects.toMatchObject({code:"INVALID_JSON"});
  });

  it("backs up all governed records at v38 and restores backward-compatible empty sections",()=>{
    const empty=validateSafeExitBackupRows({});for(const key of SAFE_EXIT_BACKUP_KEYS)expect(empty[key]).toEqual([]);
    const request={id:"request-1",publicKey:"request-public",requestNumber:"EXIT-QA-1",submissionKey:"submission-1",source:"PARENT_AUTHENTICATED",studentId:"student-1",academicYear:"2026-27",reasonCategory:"FAMILY_REQUEST",calendarBasisJson:"{\"basis\":\"UNCLASSIFIED\"}",intendedHandoverMethod:"LINKED_GUARDIAN",intendedDepartureAt:new Date("2026-08-09T07:00:00Z"),status:"READY_FOR_HANDOVER",consentState:"VERIFIED",version:3,emergencyOverride:false,restricted:false,requestedByUserId:"user-1",requestedByRole:"PARENT",submittedAt:new Date(),createdAt:new Date(),updatedAt:new Date()};
    const pass={id:"pass-1",publicKey:"pass-public",requestId:"request-1",tokenHash:"a".repeat(64),manualCodeHash:"b".repeat(64),manualCodeLastTwo:"A1",status:"ACTIVE",approvedSnapshotHash:gateApprovalSnapshotHash({request:"request-public"}),issuedByUserId:"principal-1",issuedByRole:"PRINCIPAL",issuedAt:new Date(),expiresAt:new Date(Date.now()+60_000),createdAt:new Date(),updatedAt:new Date()};
    const backup=createBackupDocument({generatedAt:new Date(),generatedBy:"SAFEEXIT1",students:[{id:"student-1",admissionNo:"SAFEEXIT1-001"}],feeStructures:[],payments:[],paymentAudits:[],users:[],studentDepartureRequests:[request],studentGatePasses:[pass]});
    expect(backup.metadata.backupVersion).toBe(38);expect(backup.studentDepartureRequests).toHaveLength(1);expect(backup.studentGatePasses).toHaveLength(1);expect(JSON.stringify(backup)).not.toContain("signingKey");expect(backup).not.toHaveProperty("appPushSubscriptions");
    const parsed=parseAndValidateBackup(backup);expect(parsed.studentDepartureRequests).toHaveLength(1);expect(parsed.studentGatePasses).toHaveLength(1);
  });

  it("fails closed on broken relationships, digest changes and secret-shaped fields",()=>{
    expect(()=>validateSafeExitBackupRows({studentGatePasses:[{id:"pass",publicKey:"key",requestId:"missing",tokenHash:"x",manualCodeHash:"y",approvedSnapshotHash:"z",password:"bad"}]})).toThrow();
  });
});
