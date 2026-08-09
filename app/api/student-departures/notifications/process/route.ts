import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSafeExitNotificationOutbox } from "@/lib/safe-exit-notifications";
import { processOverdueSafeExitReturns } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["VIEW_DEPARTURE_AUDIT"]);if(auth.response||!auth.actor||!["SUPER_ADMIN","DIRECTOR","PRINCIPAL"].includes(auth.actor.user.role))return auth.response??safeExitJson({error:"Leadership authority is required."},403);try{const body=await parseSafeExitJson(request),limit=Number(body.limit??25),overdue=await processOverdueSafeExitReturns(prisma,auth.actor,{limit});return safeExitJson({overdue,summary:await processSafeExitNotificationOutbox(prisma,{limit})});}catch(error){return safeExitApiError(error);}}
