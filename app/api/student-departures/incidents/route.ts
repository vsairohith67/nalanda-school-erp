import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordUnauthorisedExit } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["RECORD_UNAUTHORISED_EXIT"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({request:await recordUnauthorisedExit(prisma,auth.actor,await parseSafeExitJson(request))},201);}catch(error){return safeExitApiError(error);}}
