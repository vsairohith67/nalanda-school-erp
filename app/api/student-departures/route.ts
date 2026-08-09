import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSafeExitRequest, listSafeExitRequests, listStandingDepartureAuthorizations } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function GET(){const auth=await safeExitApiActor(["REQUEST_STUDENT_DEPARTURE","VERIFY_GATE_PASS","VIEW_DEPARTURE_AUDIT","MANAGE_STANDING_EXIT_PERMISSION"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({requests:await listSafeExitRequests(prisma,auth.actor),standingAuthorisations:auth.actor.permissions.has("MANAGE_STANDING_EXIT_PERMISSION")?await listStandingDepartureAuthorizations(prisma,auth.actor):[]});}catch(error){return safeExitApiError(error);}}
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["REQUEST_STUDENT_DEPARTURE"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({request:await createSafeExitRequest(prisma,auth.actor,await parseSafeExitJson(request))},201);}catch(error){return safeExitApiError(error);}}
