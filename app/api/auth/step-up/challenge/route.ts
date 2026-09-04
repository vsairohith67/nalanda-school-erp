import { NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson } from "@/lib/real-user-access/activation-api";
import { createStepUpChallenge } from "@/lib/real-user-access/step-up";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();const auth=await getCurrentAuthContext();if(!auth)return activationJson({error:"Authentication required"},401);try{const body=await request.json() as Record<string,unknown>;assertBoundedJsonValue(body,{maximumArrayLength:1,maximumStringLength:128,maximumJsonNodes:6});const result=await createStepUpChallenge(prisma,{userId:auth.user.id,sessionId:auth.sessionId,action:String(body.action??""),environment:activationEnvironment()});return activationJson(result);}catch{return activationJson({error:"Additional verification could not be started."},400);}}
