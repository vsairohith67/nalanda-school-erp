import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeSafeExitCheckout, verifySafeExitGatePass } from "@/lib/safe-exit";
import { parseSafeExitJson, safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function POST(request:NextRequest){const auth=await safeExitApiActor(["VERIFY_GATE_PASS","COMPLETE_STUDENT_CHECKOUT"]);if(auth.response||!auth.actor)return auth.response;try{const body=await parseSafeExitJson(request);return String(body.action??"verify")==="checkout"?safeExitJson({request:await completeSafeExitCheckout(prisma,auth.actor,body)}):safeExitJson({verification:await verifySafeExitGatePass(prisma,auth.actor,body)});}catch(error){return safeExitApiError(error);}}
