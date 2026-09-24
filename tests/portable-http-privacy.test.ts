import {describe,it,expect} from "vitest";
import {referenceToken,assertVerification,assertDenial,assertEventDelta,assertSingleEffect,checkedRead} from "../scripts/portable/http-assertions";
import {decodeCertificateQr} from "../scripts/portable/certificate-qr";
import {writeFileSync,existsSync,readFileSync} from "node:fs";
import path from "node:path";
import {PDFDocument} from "pdf-lib";

const token="A".repeat(43);
const headers={"content-type":"application/json","cache-control":"private, no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
describe("HTTP privacy assertions (UNIT_OR_CONTRACT, no server)",()=>{
 it("accepts only the local certificate URN; never interprets decoded text as a URL",()=>{
  expect(referenceToken(`urn:nalanda:certificate:${token}`)).toBe(token);
  for(const bad of [`https://evil.invalid/${token}`,`javascript:${token}`,token,`urn:nalanda:certificate:${token}\nother`,"urn:nalanda:certificate:short"])expect(()=>referenceToken(bad)).toThrow();
 });
 it("checks the complete verification contract and private headers",async()=>{
  const good={status:"ISSUED",authentic:true,certificateType:"GRADUATION",academicYear:"2026-27",issuerKind:"SCHOOL_INSTITUTIONAL"};
  await assertVerification(response(good),good,["SYNTHETIC-PRIVATE"]);
  for(const field of ["studentName","fatherName","phone","dob","marks","income","session","storagePath"])await expect(assertVerification(response({...good,[field]:"SYNTHETIC-PRIVATE"}),good,["SYNTHETIC-PRIVATE"])).rejects.toThrow();
  await expect(assertVerification(new Response(JSON.stringify(good)),good,[])).rejects.toThrow();
  for(const status of ["SUPERSEDED","VOID","UNAVAILABLE"])await assertVerification(response({status,authentic:false}),{status,authentic:false},[]);
  await expect(assertVerification(response({status:"VOID",authentic:false}),{status:"SUPERSEDED",authentic:false},[])).rejects.toThrow();
 });
 it("does not confuse workflow/input/transport/rate failures with revoked authority",async()=>{
  await assertDenial(response({error:"Authentication required"},401),401,{error:"Authentication required"},[]);
  for(const status of [200,400,409,429,500])await expect(assertDenial(response({error:"Authentication required"},status),401,{error:"Authentication required"},[])).rejects.toThrow();
  await expect(assertDenial(response({error:"Invalid body"},403),403,{error:"You do not have permission for this action"},[])).rejects.toThrow();
  await expect(assertDenial(response({error:"Authentication required",pdf:"PRIVATE"},401),401,{error:"Authentication required"},["PRIVATE"])).rejects.toThrow();
 });
 it("requires exact new audit rows and rejects unrelated actors, targets, actions, missing and duplicate effects",()=>{
  const before=[{id:"existing",eventType:"OLD"}],event={id:"new",actorId:"actor",caseId:"case",eventType:"RELIEF_APPLIED",requestKey:"request"};
  assertEventDelta(before,[...before,event],[{actorId:"actor",caseId:"case",eventType:"RELIEF_APPLIED",requestKey:"request"}]);
  for(const changed of [{actorId:"other"},{caseId:"other"},{eventType:"OTHER"},{requestKey:"other"}])expect(()=>assertEventDelta(before,[...before,{...event,...changed}],[event])).toThrow();
  expect(()=>assertEventDelta(before,before,[event])).toThrow();
  expect(()=>assertEventDelta(before,[...before,event,{...event,id:"duplicate"}],[event])).toThrow();
  expect(()=>assertEventDelta(before,[{...before[0],eventType:"ALTERED"}],[])).toThrow();
 });
 it("refuses a wrongly bound target before readback and rechecks after a read",async()=>{
  let reads=0;await expect(checkedRead(()=>{throw Error("FOREIGN_SERVING_TARGET");},async()=>++reads)).rejects.toThrow();expect(reads).toBe(0);
  let checks=0;await expect(checkedRead(()=>{if(++checks===2)throw Error("TARGET_CHANGED");},async()=>++reads)).rejects.toThrow();expect(reads).toBe(1);
 });
 it("rejects duplicate authoritative receipts or document versions independently of access-log counts",()=>{
  const effect={id:"receipt",studentId:"run-student",createdByUserId:"collector"};assertSingleEffect([effect],effect);
  expect(()=>assertSingleEffect([effect,{...effect,id:"duplicate"}],effect)).toThrow();
  expect(()=>assertSingleEffect([],{certificateId:"certificate",versionNumber:1})).toThrow();
  expect(()=>assertSingleEffect([{id:"version",certificateId:"other",versionNumber:1}],{certificateId:"certificate",versionNumber:1})).toThrow();
 });
});
describe("private QR process adapter (UNIT_OR_CONTRACT; external commands simulated)",()=>{
 it.each(["ok","raster-failure","decoder-failure","foreign-uri","multiple-qr","missing-tool","later-page","duplicate-pages","absent"])("bounds commands and removes private input after %s",async mode=>{
  const calls:string[]=[];let root="";
  const doc=await PDFDocument.create();doc.addPage();if(["later-page","duplicate-pages"].includes(mode))doc.addPage();const pdf=Buffer.from(await doc.save());let page=0;
  const run=(command:string,args:string[])=>{
   calls.push(command);
   if(command==="pdftoppm"){
    page++;root=path.dirname(args.at(-2)!);expect(readFileSync(args.at(-2)!)).toEqual(pdf);
    expect(args.slice(0,8)).toEqual(["-f",String(page),"-l",String(page),"-scale-to","2048","-singlefile","-png"]);
    if(mode==="missing-tool")throw Object.assign(Error("private transcript"),{code:"ENOENT"});
    if(mode==="raster-failure")throw Error("private transcript");
    writeFileSync(args.at(-1)!+".png",Buffer.from([137,80,78,71,13,10,26,10]));return Buffer.alloc(0);
   }
   expect(command).toBe("zbarimg");expect(args.slice(0,-1)).toEqual(["--quiet","--raw","--set","disable","--set","qrcode.enable"]);
   if(mode==="decoder-failure")throw Error("private transcript");
   if(mode==="absent"||(mode==="later-page"&&page===1))return Buffer.alloc(0);
   return Buffer.from(mode==="foreign-uri"?"https://external.invalid/private":`urn:nalanda:certificate:${token}\n${mode==="multiple-qr"?"another\n":""}`);
  };
  if(["ok","later-page"].includes(mode))expect(await decodeCertificateQr(pdf,()=>{},run)).toBe(token);
  else await expect(decodeCertificateQr(pdf,()=>{},run)).rejects.toThrow(mode==="missing-tool"?"CERTIFICATE_QR_TOOLS_NOT_EXECUTED":"PRIVATE_DETAILS_WITHHELD");
  expect(root).not.toBe("");expect(existsSync(root)).toBe(false);expect(calls[0]).toBe("pdftoppm");
 });
});
