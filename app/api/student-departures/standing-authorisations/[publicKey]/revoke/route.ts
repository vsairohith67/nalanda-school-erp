import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { revokeStandingDepartureAuthorization } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest,context:{params:Promise<{publicKey:string}>}){const auth=await safeExitApiActor(["RECORD_PARENT_CONSENT"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({authorisation:await revokeStandingDepartureAuthorization(prisma,auth.actor,(await context.params).publicKey,await parseSafeExitJson(request))});}catch(error){return safeExitApiError(error);}}
