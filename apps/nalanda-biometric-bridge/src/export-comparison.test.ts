import { expect, it } from "vitest";
import { analyzeComparison, validateComparisonRequest, type ComparisonRequest } from "./export-comparison.js";
import { parseExport } from "./export-profile.js";
import { bytes, id, profile } from "./export-test-fixtures.js";
const request:ComparisonRequest={schemaVersion:1,file:"C:/synthetic/K30.csv",interval:{from:"2026-10-02T00:00:00.000Z",to:"2026-10-02T23:59:59.000Z"}};
const capture=(b=bytes(),sourceKey="a".repeat(64),incarnation="b".repeat(64))=>({bytes:b,snapshot:{...parseExport(b,profile(),id,"2026-10-04T13:00:00.000Z"),sourceKey,incarnation}});
it("accounts every row including unmapped review, malformed rejection and all same-second peers",()=>{
  const c=capture(bytes(["0007,2026-10-02 09:00:00,SYN-LOCAL-01,IN","0007,2026-10-02 09:00:00,SYN-LOCAL-01,OUT","MISSING,2026-10-02 10:00:00,SYN-LOCAL-01,IN","bad"]));
  const a=analyzeComparison(c,undefined,request);expect(a.summary).toMatchObject({parsedRows:4,compatibleRows:0,heldRows:3,rejectedRows:1,unresolvedIntervalRows:2,operatorEvidence:"NOT_SUPPLIED",reviewRequired:true});expect(a.rows).toHaveLength(4);
});
it("preserves multiset overlap and refuses inferred append across different snapshots",()=>{
  const row="0007,2026-10-02 09:00:00,SYN-LOCAL-01,IN",first=capture(bytes([row,row]));
  const second=capture(bytes([row,row,"0007,2026-10-02 10:00:00,SYN-LOCAL-01,IN"]),"c".repeat(64));
  expect(analyzeComparison(second,first,request).summary).toMatchObject({relation:"AMBIGUOUS_REEXPORT_OR_REPLACEMENT",overlappingRows:2,heldRows:2,compatibleRows:1,reviewRequired:true});
  expect(analyzeComparison(capture(first.bytes,"d".repeat(64)),first,request).summary.relation).toBe("BYTE_IDENTICAL_REPLAY");
});
it("verifies exact byte prefix and retained same-file identity instead of row-hash append guesses",()=>{
  const first=capture(),tail=Buffer.from("0007,2026-10-02 10:00:00,SYN-LOCAL-01,OUT\r\n"),second=capture(Buffer.concat([first.bytes,tail]));
  expect(analyzeComparison(second,first,request).summary.relation).toBe("VERIFIED_SAME_FILE_APPEND");
  const lf=capture(Buffer.from(second.bytes.toString().replace(/\r\n/g,"\n")));
  expect(analyzeComparison(lf,first,request).summary.relation).toBe("AMBIGUOUS_REEXPORT_OR_REPLACEMENT");
  expect(analyzeComparison(capture(second.bytes,first.snapshot.sourceKey,"e".repeat(64)),first,request).summary.relation).toBe("AMBIGUOUS_REEXPORT_OR_REPLACEMENT");
});
it("keeps independently supplied checks separate and reports discrepancy without approving attendance",()=>{
  const operator:NonNullable<ComparisonRequest["operator"]>={origin:"OPERATOR_SOURCE_VIEW",reference:"synthetic-operator-note",totalRows:2,inRows:1,outRows:0,observations:[{opaqueDeviceUserId:"SYN-USER-0007",punchTimestamp:"2026-10-02T03:30:00.000Z",punchCode:"IN",count:2}]};
  const a=analyzeComparison(capture(),undefined,{...request,operator});expect(a.summary.operatorEvidence).toBe("DISCREPANCY_OR_UNRESOLVED");expect(a.totals[0]).toEqual({kind:"totalRows",supplied:2,observed:1,matches:false});expect(a.summary.businessAttendanceApproval).toBe("NOT_GRANTED");
  const b=analyzeComparison(capture(),undefined,{...request,operator:{origin:"OPERATOR_SOURCE_VIEW",reference:"synthetic-independent-count",totalRows:1}});expect(b.summary.operatorEvidence).toBe("SUPPLIED_CHECKS_MATCH");expect(b.summary.physicalDeviceOrigin).toBe("NOT_AUTHENTICATED");expect(b.summary).not.toHaveProperty("profileHash");expect(JSON.stringify(b.summary)).not.toContain("0007");
});
it("makes selected interval limits and unresolved values explicit",()=>{
  const a=analyzeComparison(capture(),undefined,{...request,interval:{from:"2026-10-03T00:00:00.000Z",to:"2026-10-03T23:59:59.000Z"},operator:{origin:"OPERATOR_SOURCE_VIEW",reference:"synthetic-empty-interval",totalRows:0}});expect(a.summary).toMatchObject({outsideIntervalRows:1,selectedIntervalRows:0,reviewRequired:true});
});
it("rejects external authority, unsupported intervals and invalid independent assertions",()=>{
  expect(()=>validateComparisonRequest({...request,endpoint:"https://example.invalid"})).toThrow("EXPORT_REVIEW_REQUEST_INVALID");
  expect(()=>validateComparisonRequest({...request,interval:{from:"2026-02-30T00:00:00.000Z",to:request.interval.to}})).toThrow("EXPORT_REVIEW_INTERVAL_INVALID");
  expect(()=>validateComparisonRequest({...request,operator:{origin:"PARSER_DERIVED",reference:"x",totalRows:1}})).toThrow("EXPORT_REVIEW_OPERATOR_INVALID");
  expect(()=>validateComparisonRequest({...request,compareFile:request.file,previousReport:request.file})).toThrow("EXPORT_REVIEW_REQUEST_INVALID");
});
