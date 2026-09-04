import { NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson } from "@/lib/real-user-access/activation-api";
import { completeStepUpChallenge } from "@/lib/real-user-access/step-up";
import { assertBoundedJsonValue } from "@/lib/request-security";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();const auth=await getCurrentAuthContext();if(!auth)return activationJson({error:"Authentication required"},401);try{const body=await request.json() as Record<string,unknown>;assertBoundedJsonValue(body,{maximumArrayLength:8,maximumStringLength:16384,maximumJsonNodes:64});const factor=String(body.factor??"") as "TOTP"|"WEBAUTHN";if(!(["TOTP","WEBAUTHN"] as const).includes(factor))throw new Error("STEP_UP_FACTOR_REFUSED");const result=await completeStepUpChallenge(prisma,{challengeToken:String(body.challengeToken??""),userId:auth.user.id,sessionId:auth.sessionId,action:String(body.action??""),environment:activationEnvironment(),factor,response:factor==="WEBAUTHN"?body.response as AuthenticationResponseJSON:String(body.response??"")});return activationJson(result);}catch{return activationJson({error:"Additional verification was refused."},400);}}
