import { describe, expect, it } from "vitest";
import { CERTIFICATE_TYPES, defaultTemplateDefinition, normalizeCode, validateCertificateTemplateDefinition } from "@/lib/certificate-templates";
import { formatCertificateNumber, previewCertificateNumber, allocateCertificateNumber, validateNumberSeriesInput } from "@/lib/certificate-numbering";
import { certificateReportSummary, certificateReportsCsv } from "@/lib/certificate-reports";
import { buildCertificateSourceSnapshot, snapshotHash } from "@/lib/certificate-snapshots";
import { validateRequestInput, createCertificateRequest, transitionCertificateRequest } from "@/lib/certificate-requests";
import { createStudentCertificateDraft, updateCertificateDraft } from "@/lib/student-certificates";
import { can } from "@/lib/permissions";

describe("certificate template and numbering safety",()=>{
  it("supports only the four prompt-authorised types",()=>expect(CERTIFICATE_TYPES).toEqual(["BONAFIDE","STUDY","CONDUCT","TRANSFER"]));
  it("normalises codes and rejects empty codes",()=>{expect(normalizeCode(" qa bon 1 ")).toBe("QA-BON-1");expect(()=>normalizeCode("!!!")).toThrow(/Code/);});
  it.each(CERTIFICATE_TYPES)("creates a safe default %s definition",(type)=>expect(()=>validateCertificateTemplateDefinition(type,defaultTemplateDefinition(type))).not.toThrow());
  it("rejects executable HTML and sensitive fields",()=>{expect(()=>validateCertificateTemplateDefinition("BONAFIDE",{heading:"X",body:"<script>alert(1)</script>"})).toThrow(/unsafe/);expect(()=>validateCertificateTemplateDefinition("BONAFIDE",{heading:"X",body:"Safe",enabledFields:["aadhaar"]})).toThrow(/unsafe|Unsupported/);});
  it("requires reviewed custom conduct wording",()=>expect(()=>validateCertificateTemplateDefinition("CONDUCT",{heading:"Conduct",body:"Text",conductStatement:"REVIEWED_CUSTOM"})).toThrow(/custom/));
  it("accepts approved satisfactory and bounded reviewed custom conduct wording",()=>{
    expect(validateCertificateTemplateDefinition("CONDUCT",{heading:"Conduct",body:"Text",conductStatement:"SATISFACTORY"}).conductStatement).toBe("SATISFACTORY");
    expect(validateCertificateTemplateDefinition("CONDUCT",{heading:"Conduct",body:"Text",conductStatement:"REVIEWED_CUSTOM",customConductText:"Consistently courteous and responsible."}).customConductText).toBe("Consistently courteous and responsible.");
    expect(()=>validateCertificateTemplateDefinition("CONDUCT",{heading:"Conduct",body:"Text",conductStatement:"REVIEWED_CUSTOM",customConductText:"x".repeat(501)})).toThrow(/at most 500/);
  });
  it("formats padded number without consuming it",()=>expect(formatCertificateNumber({prefix:"BON/26/",nextNumber:7,paddingLength:4,suffix:null})).toBe("BON/26/0007"));
  it("validates positive series counters",()=>{expect(validateNumberSeriesInput({seriesCode:"BON",certificateType:"BONAFIDE",nextNumber:1,paddingLength:4}).nextNumber).toBe(1);expect(()=>validateNumberSeriesInput({seriesCode:"BON",certificateType:"BONAFIDE",nextNumber:0})).toThrow(/positive/);});
  it("previews without update and allocates with compare-and-set",async()=>{let updates=0;const series={id:"s",academicYear:"2026-27",prefix:"B/",nextNumber:1,paddingLength:3,suffix:null};const client:any={certificateNumberSeries:{findMany:async()=>[series],updateMany:async()=>{updates++;return{count:1}}}};expect((await previewCertificateNumber(client,"BONAFIDE","2026-27")).certificateNumber).toBe("B/001");expect(updates).toBe(0);expect((await allocateCertificateNumber(client,"BONAFIDE","2026-27")).certificateNumber).toBe("B/001");expect(updates).toBe(1);});
  it("rejects concurrent number allocation conflict",async()=>{const client:any={certificateNumberSeries:{findMany:async()=>[{id:"s",academicYear:"2026-27",prefix:"",nextNumber:1,paddingLength:1,suffix:null}],updateMany:async()=>({count:0})}};await expect(allocateCertificateNumber(client,"BONAFIDE","2026-27")).rejects.toThrow(/another issue/);});
  it("blocks issue when no active applicable number series exists",async()=>{const client:any={certificateNumberSeries:{findMany:async()=>[]}};await expect(previewCertificateNumber(client,"BONAFIDE","2026-27")).rejects.toThrow(/No active default/);});
  it("blocks ambiguous active defaults instead of silently selecting one",async()=>{const client:any={certificateNumberSeries:{findMany:async()=>[{id:"a",academicYear:"2026-27",prefix:"A/",nextNumber:1,paddingLength:1,suffix:null},{id:"b",academicYear:"2026-27",prefix:"B/",nextNumber:1,paddingLength:1,suffix:null}]}};await expect(previewCertificateNumber(client,"BONAFIDE","2026-27")).rejects.toThrow(/Multiple active default/);});
  it("hashes immutable snapshots deterministically",()=>{expect(snapshotHash({a:1})).toBe(snapshotHash({a:1}));expect(snapshotHash({a:1})).not.toBe(snapshotHash({a:2}));});
});

describe("certificate request workflow and permissions",()=>{
  it("requires purpose and enforces the three-copy maximum",()=>{expect(()=>validateRequestInput({certificateType:"BONAFIDE",purpose:"",requestedCopies:1})).toThrow(/Purpose/);expect(()=>validateRequestInput({certificateType:"BONAFIDE",purpose:"Use",requestedCopies:4})).toThrow(/1 to 3/);});
  it("blocks an unrelated Parent child server-side",async()=>{const client:any={studentGuardian:{findUnique:async()=>null}};await expect(createCertificateRequest(client,{studentId:"other",academicYear:"2026-27",certificateType:"BONAFIDE",purpose:"Use"},{id:"u",guardianId:"g",source:"PARENT_PORTAL"})).rejects.toMatchObject({status:403});});
  it("creates a linked Parent submitted request without exposing fact editing",async()=>{let created:any;const client:any={studentGuardian:{findUnique:async()=>({id:"link"})},studentCertificateRequest:{create:async({data}:any)=>(created={id:"r",...data})},studentCertificateEvent:{create:async()=>({})}};const row=await createCertificateRequest(client,{studentId:"s",academicYear:"2026-27",certificateType:"STUDY",purpose:"Admission"},{id:"u",guardianId:"g",source:"PARENT_PORTAL"});expect(row).toMatchObject({status:"SUBMITTED",requestSource:"PARENT_PORTAL",applicantGuardianId:"g"});expect(created).not.toHaveProperty("studentName");});
  it("requires rejection and cancellation reasons",async()=>{const client:any={studentCertificateRequest:{findUnique:async()=>({id:"r",status:"UNDER_REVIEW",updatedAt:new Date()})}};await expect(transitionCertificateRequest(client,"r","reject","u",undefined,"")).rejects.toThrow(/reason/);});
  it("uses compare-and-set for request transitions",async()=>{let where:any;const now=new Date("2026-07-17");const client:any={studentCertificateRequest:{findUnique:async()=>({id:"r",status:"SUBMITTED",updatedAt:now}),updateMany:async(input:any)=>(where=input.where,{count:1})},studentCertificateEvent:{create:async()=>({})}};await transitionCertificateRequest(client,"r","review","u",now.toISOString());expect(where).toMatchObject({id:"r",status:"SUBMITTED",updatedAt:now});});
  it("gives leadership full workflow, Admin no issue, and Teacher/Accountant none",()=>{expect(can("PRINCIPAL","ISSUE_CERTIFICATES")).toBe(true);expect(can("ADMIN","REVIEW_CERTIFICATES")).toBe(true);expect(can("ADMIN","ISSUE_CERTIFICATES")).toBe(false);expect(can("TEACHER","VIEW_CERTIFICATES")).toBe(false);expect(can("ACCOUNTANT","VIEW_CERTIFICATES")).toBe(false);});
  it("gives Viewer aggregate reports without export",()=>{expect(can("VIEWER","VIEW_CERTIFICATE_REPORTS")).toBe(true);expect(can("VIEWER","EXPORT_CERTIFICATE_REPORTS")).toBe(false);});
  it("gives Parent only linked-child request/view permissions",()=>{expect(can("PARENT","REQUEST_OWN_CHILD_CERTIFICATES")).toBe(true);expect(can("PARENT","VIEW_OWN_CHILD_CERTIFICATES")).toBe(true);expect(can("PARENT","VIEW_CERTIFICATES")).toBe(false);});
});

describe("certificate source and immutable edit safety",()=>{
  it("normalizes and validates certificate academic year before snapshot or persistence",async()=>{
    let created:any,attendanceWhere:any;
    const client:any={
      certificateTemplate:{findUnique:async()=>({id:"t",status:"ACTIVE",certificateType:"STUDY",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition("STUDY"))})},
      student:{findUnique:async()=>({id:"s",admissionNo:"A1",studentName:"Student",fatherName:null,motherName:null,className:"I",section:"A",dateOfBirth:null,status:"Active",createdAt:new Date()})},
      academicYearEnrollment:{findMany:async()=>[]},
      studentAttendanceRecord:{findMany:async({where}:any)=>(attendanceWhere=where,[])},
      studentProgressionDecision:{findFirst:async()=>null},
      studentCertificate:{create:async({data}:any)=>(created={id:"c",...data})},
      studentCertificateEvent:{create:async()=>({})}
    };
    await createStudentCertificateDraft(client,{studentId:"s",templateId:"t",academicYear:" 2026-27 ",certificateType:"STUDY",purpose:"Admission"},"u");
    expect(created.academicYear).toBe("2026-27");
    expect(attendanceWhere.session.academicYear).toBe("2026-27");
    await expect(createStudentCertificateDraft(client,{studentId:"s",templateId:"t",academicYear:"2026-99",certificateType:"STUDY",purpose:"Admission"},"u")).rejects.toThrow(/consecutive YYYY-YY/i);
  });
  it("uses historical wording and never fabricates a missing current year",async()=>{const client:any={student:{findUnique:async()=>({id:"s",admissionNo:"A1",studentName:"Student",fatherName:null,motherName:null,className:"Class 8",section:"A",dateOfBirth:null,status:"Inactive",createdAt:new Date()})},academicYearEnrollment:{findMany:async()=>[{academicYear:"2024-25",className:"Class 6",section:"A",status:"COMPLETED",enrollmentDate:new Date("2024-06-01"),exitDate:new Date("2025-03-31"),exitReason:null}]},studentAttendanceRecord:{findMany:async()=>[]},studentProgressionDecision:{findFirst:async()=>null}};const snapshot:any=await buildCertificateSourceSnapshot(client,"s","2026-27","STUDY","Admission");expect(snapshot.currentEnrollment).toBeNull();expect(snapshot.enrollmentWording).toBe("was a bonafide Student");expect(snapshot.attendance).toBeNull();expect(snapshot.progression.display).toBe("Promotion decision not recorded.");expect(snapshot.warnings.join(" ")).toMatch(/incomplete|unavailable/i);});
  it("requires a reason for reviewed source overrides",async()=>{const client:any={studentCertificate:{findUnique:async()=>({id:"c",status:"DRAFT",updatedAt:new Date(),issuePurpose:"Use"})}};await expect(updateCertificateDraft(client,"c",{reviewedOverrides:{academicYear:"2025-26"}},"u")).rejects.toThrow(/override reason/);});
  it("blocks ordinary edits after issue",async()=>{const client:any={studentCertificate:{findUnique:async()=>({id:"c",status:"ISSUED",updatedAt:new Date(),issuePurpose:"Use"})}};await expect(updateCertificateDraft(client,"c",{issuePurpose:"Changed"},"u")).rejects.toThrow(/Only a draft/);});
});

describe("certificate reports and CSV",()=>{
  it("counts operational statuses, revisions, source groups, and turnaround exactly",()=>{const s=certificateReportSummary([{status:"SUBMITTED",certificateType:"BONAFIDE",requestSource:"PARENT_PORTAL"},{status:"APPROVED",certificateType:"TRANSFER",requestSource:"INTERNAL",submittedAt:"2026-07-17T00:00:00Z",completedAt:"2026-07-17T06:00:00Z"}],[{status:"ISSUED",certificateType:"BONAFIDE",draftDataJson:"{}"}],[{seriesCode:"B",certificateType:"BONAFIDE",nextNumber:2}],[{eventType:"CERTIFICATE_CORRECTED"},{eventType:"CERTIFICATE_REISSUED"}]);expect(s).toMatchObject({requests:2,submitted:1,approvedAwaitingIssue:1,parentRequests:1,issued:1,corrected:1,reissued:1,averageTurnaroundHours:6,requestsByType:{BONAFIDE:1,TRANSFER:1},requestsBySource:{PARENT_PORTAL:1,INTERNAL:1}});});
  it("formula-protects the explicit allowlist",()=>{const csv=certificateReportsCsv([{requestNumber:"=cmd",academicYear:"2026-27",certificateType:"BONAFIDE",requestSource:"INTERNAL",urgency:"NORMAL",requestStatus:"ISSUED",certificateNumber:"+bad",certificateStatus:"ISSUED",issueDate:"2026-07-17"}]);expect(csv).toContain("'=cmd");expect(csv).toContain("'+bad");for(const forbidden of["aadhaar","religion","phone","actorId","fee"])expect(csv.toLowerCase()).not.toContain(forbidden.toLowerCase());});
});
