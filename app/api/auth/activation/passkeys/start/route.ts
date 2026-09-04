import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activationEnvironment, activationFeatureUnavailable, activationJson, activationToken } from "@/lib/real-user-access/activation-api";
import { beginActivationPasskey } from "@/lib/real-user-access/activation-mfa";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request:NextRequest){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();try{const result=await beginActivationPasskey(prisma,{activationToken:activationToken(request),environment:activationEnvironment(),displayName:"Passkey"});return activationJson(result);}catch{return activationJson({error:"Passkey enrolment is unavailable in this environment."},400);}}
