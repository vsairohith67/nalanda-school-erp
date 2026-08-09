import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSafeExitRequest, parentSafeExitContext } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function GET(){const auth=await safeExitApiActor(["REQUEST_STUDENT_DEPARTURE"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson(await parentSafeExitContext(prisma,auth.actor));}catch(error){return safeExitApiError(error);}}
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["REQUEST_STUDENT_DEPARTURE"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({request:await createSafeExitRequest(prisma,auth.actor,{...(await parseSafeExitJson(request)),source:"PARENT_AUTHENTICATED"})},201);}catch(error){return safeExitApiError(error);}}
