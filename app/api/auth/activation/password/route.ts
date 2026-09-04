import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { activationEnvironment, activationFeatureUnavailable, activationJson, activationToken } from "@/lib/real-user-access/activation-api";
import { establishActivationPassword } from "@/lib/real-user-access/workflow";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function POST(request: NextRequest) { if (!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE)) return activationFeatureUnavailable(); try { const body=await request.json() as Record<string,unknown>; assertBoundedJsonValue(body,{maximumArrayLength:1,maximumStringLength:256,maximumJsonNodes:6}); await establishActivationPassword(prisma,{activationToken:activationToken(request),environment:activationEnvironment(),password:String(body.password??"")}); return activationJson({success:true,next:"ENROL_MFA"}); } catch { return activationJson({error:"The credential could not be established."},400); } }
