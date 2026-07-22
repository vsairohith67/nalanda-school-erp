import { describe,expect,it } from "vitest";
import { restoreSubstituteAssignmentData } from "../lib/restore-database";
import { emptyEntityResult } from "../lib/restore";

const backupStaff=[{id:"absent-backup",staffCode:"A-1"},{id:"sub-backup",staffCode:"S-1"}];
const assignment={id:"assignment-backup",assignmentDate:"2026-06-28T00:00:00.000Z",academicYear:"2026-27",leaveRequestId:"leave-backup",absentStaffMemberId:"absent-backup",substituteStaffMemberId:"sub-backup",timetableAssignmentId:"tt-1",className:"VI",section:"A",subject:"Math",periodLabel:"Period III",periodStartTime:"10:30",periodEndTime:"11:10",reason:"APPROVED_LEAVE",status:"CANCELLED",priority:"URGENT",notes:"restored",assignedByUserId:"user-backup",confirmedByUserId:"user-backup",completedByUserId:null,cancelledByUserId:"user-backup",assignedAt:"2026-06-28T01:00:00.000Z",confirmedAt:"2026-06-28T01:05:00.000Z",completedAt:null,cancelledAt:"2026-06-28T01:10:00.000Z",cancellationReason:"School closed",createdAt:"2026-06-28T00:30:00.000Z"};

function fixture(options:{missingSubstitute?:boolean}={}){
 const rows=new Map<string,any>();
 const staff=[{id:"absent-local",staffCode:"A-1"},...(options.missingSubstitute?[]:[{id:"sub-local",staffCode:"S-1"}])];
 const client={
  staffMember:{findFirst:async({where}:{where:{OR:Array<{id?:string;staffCode?:string}>}})=>staff.find(row=>where.OR.some(term=>term.id===row.id||term.staffCode===row.staffCode))??null},
  staffLeaveRequest:{findUnique:async()=>null,findFirst:async()=>({id:"leave-local",staffMemberId:"absent-local"})},
  timetableAssignment:{findUnique:async()=>({id:"tt-1"})},
  substituteAssignment:{findUnique:async({where}:{where:{id:string}})=>rows.get(where.id)??null,findFirst:async()=>null,create:async({data}:{data:any})=>{rows.set(data.id,data);return data},update:async({where,data}:{where:{id:string};data:any})=>{const value={...rows.get(where.id),...data};rows.set(where.id,value);return value}}
 };
 return {client,rows};
}

describe("substitute assignment restore",()=>{
 it("maps safe staff, leave, timetable, user, workflow, and cancellation fields",async()=>{const f=fixture();const result={substituteAssignments:emptyEntityResult(),warnings:[] as string[]};await restoreSubstituteAssignmentData(f.client as never,{substituteAssignments:[assignment],staffMembers:backupStaff,staffLeaveRequests:[{id:"leave-backup",staffMemberId:"absent-backup",startDate:"2026-06-28T00:00:00.000Z",endDate:"2026-06-28T00:00:00.000Z",leaveType:"CASUAL"}]},new Map([["user-backup","user-local"]]),result);expect(result.substituteAssignments.created).toBe(1);expect(f.rows.get("assignment-backup")).toMatchObject({absentStaffMemberId:"absent-local",substituteStaffMemberId:"sub-local",leaveRequestId:"leave-local",timetableAssignmentId:"tt-1",status:"CANCELLED",className:"VI",section:"A",subject:"Math",periodLabel:"Period III",assignedByUserId:"user-local",confirmedByUserId:"user-local",cancelledByUserId:"user-local",cancellationReason:"School closed"});});
 it("reuses the restored assignment id instead of creating a duplicate",async()=>{const f=fixture();const backup={substituteAssignments:[assignment],staffMembers:backupStaff,staffLeaveRequests:[{id:"leave-backup",staffMemberId:"absent-backup",startDate:"2026-06-28T00:00:00.000Z",endDate:"2026-06-28T00:00:00.000Z",leaveType:"CASUAL"}]};const first={substituteAssignments:emptyEntityResult(),warnings:[] as string[]};await restoreSubstituteAssignmentData(f.client as never,backup,new Map(),first);const second={substituteAssignments:emptyEntityResult(),warnings:[] as string[]};await restoreSubstituteAssignmentData(f.client as never,backup,new Map(),second);expect(f.rows.size).toBe(1);expect(second.substituteAssignments.created).toBe(0);expect(second.substituteAssignments.updated+second.substituteAssignments.skipped).toBe(1);});
 it("skips a row when the substitute StaffMember link cannot be matched",async()=>{const f=fixture({missingSubstitute:true});const result={substituteAssignments:emptyEntityResult(),warnings:[] as string[]};await restoreSubstituteAssignmentData(f.client as never,{substituteAssignments:[assignment],staffMembers:backupStaff,staffLeaveRequests:[]},new Map(),result);expect(result.substituteAssignments.skipped).toBe(1);expect(result.warnings[0]).toContain("substitute StaffMember link");expect(f.rows.size).toBe(0);});
});
