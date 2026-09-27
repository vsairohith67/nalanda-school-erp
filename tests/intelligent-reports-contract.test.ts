import {describe,it,expect} from "vitest";
import {Prisma} from "@prisma/client";
import {interpretQuestion,parseQuery,type Query,type Target} from "../lib/intelligent-reports/contract";
import {classifyAttendance,decimalMatches,paise,bounded} from "../lib/intelligent-reports/readers";
import {csvCell} from "../lib/intelligent-reports/service";
import {RequestGeneration} from "../lib/intelligent-reports/request-generation";
import {readImportBytes} from "../lib/import-request";

const q:Query={family:"ACADEMIC",schoolId:"school",academicYear:"2026-27",targets:[{id:"7a",examId:"e7"},{id:"9b",examId:"e9"}],sourceState:"ISSUED",comparator:"LT",threshold:60,sort:"NAME",direction:"ASC",page:1,pageSize:25};
const choices:Target[]=[{id:"7a",className:"7",section:"A",exams:[{id:"e7",code:"E7",name:"Term 1"}]},{id:"9b",className:"9",section:"B",exams:[{id:"e9",code:"E9",name:"Term 1"}]}];
describe("Ask Nalanda strict canonical query",()=>{
  it.each(["students below 60% in 7A and 9B"," STUDENTS   below 60% in class 7-A, class 9-B "])("matches builder: %s",question=>expect(interpretQuestion(question,q,choices)).toEqual(parseQuery(q)));
  it.each(["below","at most","above","at least"])("preserves %s",(word)=>expect(interpretQuestion(`students scoring ${word} 80% in Term 1`,q,choices).comparator).toBe(({below:"LT","at most":"LTE",above:"GT","at least":"GTE"})[word]));
  it("never equates independent examinations by label or overwrites a selected exam",()=>{
    expect(()=>interpretQuestion("students above 80% in Term 1",{...q,targets:[{id:"7a"},{id:"9b"}]},choices)).toThrow("Similar examination names");
    expect(()=>interpretQuestion("students above 80% in Term 1",{...q,targets:[{id:"7a",examId:"other"}]},choices)).toThrow();
    expect(interpretQuestion("students above 80% in Term 1",q,choices).targets).toEqual(q.targets);
    const shared=choices.map(t=>({...t,exams:[{id:"same",code:"SAME",name:"Term 1"}]}));
    expect(interpretQuestion("students above 80% in Term 1",{...q,targets:[{id:"7a"},{id:"9b"}]},shared).targets.every(t=>t.examId==="same")).toBe(true);
  });
  it.each(["students not below 60%","students below 60% except girls","students below 60% in 7Z","select * from Student","students below 60% and attendance above 90%","slow learners","x".repeat(301)])("refuses unsupported or missing context: %s",question=>expect(()=>interpretQuestion(question,q,choices)).toThrow());
  it("requires explicit scopes and rejects forged projection/state/page/year",()=>{
    for(const bad of [{targets:[]},{columns:["phone1"]},{sourceState:"DRAFT"},{academicYear:"2026-29"},{page:0},{pageSize:2000},{threshold:NaN},{schoolId:"other"},{targets:[{id:"7a",examId:"e7"},{id:"7a",examId:"e7"}]}])expect(()=>parseQuery({...q,...bad})).toThrow();
  });
  it("uses real dates in the selected year and refuses exam-as-term or as-of history",()=>{
    const a=interpretQuestion("attendance below 80% between 2026-06-01 and 2026-06-30",q,choices);
    expect(a).toMatchObject({family:"ATTENDANCE",from:"2026-06-01",to:"2026-06-30",targets:[{id:"7a"},{id:"9b"}]});
    for(const bad of [{from:"2026-02-30"},{from:"2025-06-01"},{from:"2026-07-01"},{term:2}])expect(()=>parseQuery({...a,...bad})).toThrow();
    const f=interpretQuestion("outstanding fees for TERM 2 in 2026-27",q,choices);expect(f).toMatchObject({family:"FEES",term:2,comparator:"GT",threshold:0});
    expect(()=>parseQuery({...f,from:"2026-06-01"})).toThrow();
  });
});
describe("precision, bounds and stale response safety",()=>{
  it("uses stored decimal rather than rounded display",()=>{expect(decimalMatches(new Prisma.Decimal("59.999999"),q)).toBe(true);expect(decimalMatches(new Prisma.Decimal(60),q)).toBe(false);expect(decimalMatches(new Prisma.Decimal(0),q)).toBe(true);});
  it.each([[29,50,58],[7,25,28]])("compares rational %i/%i exactly at %i",(present,eligible,threshold)=>{
    const value={present,eligible,recorded:eligible,unresolved:false};
    expect(classifyAttendance(value,{threshold,comparator:"LT"})).toEqual({metric:threshold,classification:"DOES_NOT_MEET"});
    expect(classifyAttendance(value,{threshold,comparator:"GTE"}).classification).toBe("MEETS");
  });
  it("keeps missing, zero eligible and partial policy unresolved",()=>{for(const value of [{present:0,eligible:0,recorded:0,unresolved:false},{present:0,eligible:10,recorded:9,unresolved:false},{present:1,eligible:1,recorded:1,unresolved:true}])expect(classifyAttendance(value,q).metric).toBeNull();});
  it("bounds source rows and rejects unsafe money",()=>{expect(paise(10.25)).toBe(1025);expect(()=>paise(Infinity)).toThrow();expect(()=>paise(-1)).toThrow();expect(()=>bounded([1,2],1,"test")).toThrow("No partial report");});
  it.each(["=SUM(1,2)"," +1","\t@SUM(A1)","-3","\r=cmd"])("neutralises CSV formula %s",v=>expect(csvCell(v).startsWith('"\'')).toBe(true));
  it("quotes CSV and invalidates all prior request generations synchronously",()=>{
    expect(csvCell('a"b')).toBe('"a""b"');const r=new RequestGeneration(),one=r.begin(),two=r.begin();expect(one.signal.aborted).toBe(true);expect(r.current(one.generation)).toBe(false);expect(r.current(two.generation)).toBe(true);r.invalidate();expect(two.signal.aborted).toBe(true);expect(r.current(two.generation)).toBe(false);
  });
  it("stops a streamed body at the limit without Content-Length",async()=>{
    let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(c){c.enqueue(new Uint8Array(9000));},cancel(){cancelled=true;}});
    await expect(readImportBytes(new Request("http://127.0.0.1",{method:"POST",body:stream,duplex:"half"} as RequestInit),16000)).rejects.toThrow("byte limit");expect(cancelled).toBe(true);
  });
});
