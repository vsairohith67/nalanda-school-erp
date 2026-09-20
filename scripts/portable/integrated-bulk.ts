import assert from "node:assert/strict";
import {mkdirSync,writeFileSync,readFileSync,lstatSync} from "node:fs";
import {PrismaClient} from "@prisma/client";
import {runBulkAcceptance} from "../qa-ux-bulk-data-exchange-e2e";
import {assertSyntheticServingTarget,privateHttp,syntheticOrigin,realLogin,provisionSyntheticMfa} from "./acceptance-http";
import {ensureDefaultRolePermissions} from "../../lib/role-permissions";
import {hashPassword} from "../../lib/password";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {integratedBusiness} from "./integrated-business";

async function main(){
 assertSyntheticServingTarget();const capability=syntheticFeatureCapability()!;
 let input="";for await(const chunk of process.stdin){input+=chunk;assert(input.length<=1024);}
 const {password}=JSON.parse(input);assert(typeof password==="string"&&password.length>=48&&password.length<=128);
 const root="/tmp/integrated-bulk-private";mkdirSync(root,{mode:0o700});
 const db=new PrismaClient();
 try{
  // This is a fresh ON project; never overwrite seeded or operational users.
  assert.equal(await db.student.count(),0);assert.equal(await db.user.count(),0);
  await ensureDefaultRolePermissions(db);
  await db.schoolSettings.create({data:{id:"school",schoolName:"NALANDA PUBLIC SCHOOL",academicYear:"2026-27",addressLine1:"SYNTHETIC ISOLATED ACCEPTANCE",city:"SYNTHETIC",phone:"SYNTHETIC-NO-CONTACT"}});
  const admin=await db.user.create({data:{username:"director",name:"SYNTHETIC acceptance administrator",role:"SUPER_ADMIN",passwordHash:await hashPassword(password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
  await db.userRoleAssignment.create({data:{userId:admin.id,role:"SUPER_ADMIN",reason:"SYNTHETIC isolated acceptance",activeKey:`${admin.id}:SUPER_ADMIN`}});
  await db.authLoginAlias.create({data:{userId:admin.id,type:"USERNAME",normalizedValue:"director",displayMasked:"director",status:"VERIFIED",verifiedAt:new Date()}});
  const login=async(username:string)=>{
   const user=await db.user.findUniqueOrThrow({where:{username}});
   // Fixture security setup uses genuine enrollment verification. Session and
   // step-up grants are subsequently issued only by actual HTTP routes.
   if(!await db.mfaAuthenticator.count({where:{userId:user.id}}))await provisionSyntheticMfa(db,user.id);
   return (await realLogin(db,username,password)).cookie;
  };
  const options={root,db,password,origin:syntheticOrigin,source:capability.source,guard:assertSyntheticServingTarget,http:privateHttp as typeof fetch,login};
  await runBulkAcceptance({...options,phase:"prepare"});await runBulkAcceptance({...options,phase:"on"});
  const report=JSON.parse(readFileSync(root+"/bulk-on-result.json","utf8"));
  assert(report.checks.includes("controlled_bundle_validate_approve_execute_readback"));
  report.businessChecks=await integratedBusiness(db,password);
  assertSyntheticServingTarget();
  console.log(JSON.stringify({...report,classification:"AUTHENTICATED_SYNTHETIC_TEST_IMAGE_HTTP",productionImageAcceptance:false,readback:"SAME_SERVING_CONTAINER_STARTUP_DATABASE",contacts:"PRIVATE_NOT_EXPORTED"}));
 }finally{
  // Encrypted/ephemeral project teardown owns database deletion. Never expose
  // error messages, request bodies or generated contact values in CI output.
  await db.$disconnect();
  const stat=lstatSync(root);assert(stat.isDirectory()&&!stat.isSymbolicLink());
  writeFileSync(root+"/completed-private-marker","CONTAINER_TEARDOWN_REQUIRED",{flag:"wx",mode:0o600});
 }
}
main().catch(()=>{console.error("INTEGRATED_BULK_FAILED_PRIVATE_DETAILS_WITHHELD");process.exitCode=1;});
