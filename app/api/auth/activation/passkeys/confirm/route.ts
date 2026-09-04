import { NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson, activationToken, readBoundedAccessJson } from "@/lib/real-user-access/activation-api";
import { confirmActivationPasskey } from "@/lib/real-user-access/activation-mfa";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();try{const body=await readBoundedAccessJson(request,true);const result=await confirmActivationPasskey(prisma,{activationToken:activationToken(request),environment:activationEnvironment(),displayName:String(body.displayName??"Passkey"),challengeHandle:String(body.challengeHandle??""),response:body.response as RegistrationResponseJSON});return activationJson(result);}catch{return activationJson({error:"Passkey registration was refused."},400);}}
