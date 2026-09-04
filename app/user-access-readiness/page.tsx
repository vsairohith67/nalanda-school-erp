import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RealUserAccessReadiness } from "@/components/real-user-access-readiness";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import { realUserAccessDashboard } from "@/lib/real-user-access/dashboard";
import { ROLE_TEMPLATE_CATALOGUE } from "@/lib/real-user-access/catalogue";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";

export default async function UserAccessReadinessPage(){
  if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))notFound();
  await requirePermission("VIEW_IAM_ACCESS");
  const [dashboard,permissions,staff,guardians,students]=await Promise.all([
    realUserAccessDashboard(prisma),getCurrentUserEffectivePermissions(),
    prisma.staffMember.findMany({where:{userId:null,iamPublicKey:{not:null},status:"ACTIVE"},select:{iamPublicKey:true,displayName:true,fullName:true},orderBy:{fullName:"asc"},take:200}),
    prisma.guardian.findMany({where:{users:{none:{}},iamPublicKey:{not:null},status:{in:["Active","ACTIVE"]},students:{some:{student:{deletedAt:null,status:{in:["Active","ACTIVE"]}}}}},select:{iamPublicKey:true,displayName:true},orderBy:{displayName:"asc"},take:200}),
    prisma.student.findMany({where:{userId:null,iamPublicKey:{not:null},deletedAt:null,status:{in:["Active","ACTIVE"]}},select:{iamPublicKey:true,studentName:true,className:true,section:true},orderBy:{studentName:"asc"},take:200})
  ]);
  return <div className="page access-readiness-page"><PageHeader title="Real-User Access Readiness" description="Governed account preparation, approval, invitation, MFA, training, certification and offboarding. Operational rollout remains off until separately approved."/><RealUserAccessReadiness initial={dashboard} canManage={permissionSetCan(permissions,"MANAGE_IAM_USERS")} templates={ROLE_TEMPLATE_CATALOGUE.map((entry)=>({id:entry.id,mfa:entry.mfa,implementation:entry.implementation,temporary:entry.temporaryByDefault}))} people={{staff:staff.map((row)=>({handle:row.iamPublicKey!,label:row.displayName??row.fullName})),guardians:guardians.map((row)=>({handle:row.iamPublicKey!,label:row.displayName})),students:students.map((row)=>({handle:row.iamPublicKey!,label:`${row.studentName} · ${row.className}${row.section?` ${row.section}`:""}`}))}}/></div>;
}
