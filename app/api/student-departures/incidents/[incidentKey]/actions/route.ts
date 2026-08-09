import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordIncidentAction } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest,context:{params:Promise<{incidentKey:string}>}){const auth=await safeExitApiActor(["RECORD_UNAUTHORISED_EXIT"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({incident:await recordIncidentAction(prisma,auth.actor,(await context.params).incidentKey,await parseSafeExitJson(request))});}catch(error){return safeExitApiError(error);}}
