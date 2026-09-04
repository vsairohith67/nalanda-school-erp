import { NextRequest } from "next/server";
import { getCurrentAuthContext,requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activationFeatureUnavailable,activationJson,readBoundedAccessJson } from "@/lib/real-user-access/activation-api";
import { prepareAccessRequest, type PrepareAccessInput } from "@/lib/real-user-access/workflow";
import { isOperationalReleaseFeatureEnabled,REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();const permission=await requireApiPermission("MANAGE_IAM_USERS"),context=await getCurrentAuthContext();if(permission.response)return permission.response;if(!context)return activationJson({error:"Authentication required"},401);try{const body=await readBoundedAccessJson(request) as unknown as PrepareAccessInput;const result=await prepareAccessRequest(prisma,{user:context.user,sessionId:context.sessionId},body);return activationJson({request:result},201);}catch{return activationJson({error:"Access request could not be prepared."},400);}}
