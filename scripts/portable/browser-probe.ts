import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {assertSyntheticServingTarget,nextTotp} from "./acceptance-http";
import {certificateBrowserProbe} from "./certificate-browser-probe";
import {financeBrowserProbe} from "./finance-browser-probe";
import {marksBrowserProbe} from "./marks-browser-probe";
async function main(){
 assertSyntheticServingTarget();const [operation,encoded]=process.argv.slice(2);
 let input:any;
 if(operation==="certificate"||operation==="finance"||operation==="marks"){
  assert(!encoded);let raw="";for await(const chunk of process.stdin){raw+=chunk;assert(raw.length<=4096);}input=JSON.parse(raw);
 }else{assert(encoded&&encoded.length<1024);input=JSON.parse(Buffer.from(encoded,"base64url").toString());}
 const db=new PrismaClient();
 try{
  if(operation==="certificate"){console.log(JSON.stringify(await certificateBrowserProbe(db,input)));return;}
  if(operation==="finance"){console.log(JSON.stringify(await financeBrowserProbe(db,input)));return;}
  if(operation==="marks"){console.log(JSON.stringify(await marksBrowserProbe(db,input)));return;}
  if(operation==="totp"){
   assert.equal(input.username,"director");const user=await db.user.findUniqueOrThrow({where:{username:input.username}});
   assert.equal(user.name,"SYNTHETIC acceptance administrator");
   // Private parent pipe only. The driver never persists this response.
   console.log(JSON.stringify({token:await nextTotp(db,user.id)}));return;
  }
  assert.equal(operation,"student");assert(/^SYNTHETIC-BROWSER-[a-f0-9-]{36}$/.test(input.admission));
  const student=await db.student.findUnique({where:{admissionNo:input.admission}});
  console.log(JSON.stringify({count:student?1:0,academicYear:student?.academicYear??null,className:student?.className??null,section:student?.section??null,nameMatches:student?.studentName==="SYNTHETIC Browser Student"}));
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error("BROWSER_PRIVATE_PROBE_FAILED");process.exitCode=1;});
