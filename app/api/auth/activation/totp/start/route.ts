import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson, activationToken, readBoundedAccessJson } from "@/lib/real-user-access/activation-api";
import { beginActivationTotp } from "@/lib/real-user-access/activation-mfa";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request: NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();try{const body=await readBoundedAccessJson(request);const result=await beginActivationTotp(prisma,{activationToken:activationToken(request),environment:activationEnvironment(),displayName:String(body.displayName??"Authenticator app")});return activationJson(result);}catch{return activationJson({error:"TOTP enrolment could not be started."},400);}}
