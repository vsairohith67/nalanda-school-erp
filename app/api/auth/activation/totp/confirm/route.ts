import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson, activationToken, readBoundedAccessJson } from "@/lib/real-user-access/activation-api";
import { confirmActivationTotp } from "@/lib/real-user-access/activation-mfa";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();try{const body=await readBoundedAccessJson(request);const result=await confirmActivationTotp(prisma,{activationToken:activationToken(request),environment:activationEnvironment(),factorHandle:String(body.factorHandle??""),token:String(body.token??"")});return activationJson(result);}catch{return activationJson({error:"The TOTP code was refused."},400);}}
