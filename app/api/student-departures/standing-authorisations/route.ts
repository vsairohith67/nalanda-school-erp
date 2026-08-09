import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStandingDepartureAuthorization } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["RECORD_PARENT_CONSENT"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({authorisation:await createStandingDepartureAuthorization(prisma,auth.actor,await parseSafeExitJson(request))},201);}catch(error){return safeExitApiError(error);}}
