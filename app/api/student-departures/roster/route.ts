import { prisma } from "@/lib/prisma";
import { liveCampusRoster } from "@/lib/safe-exit";
import { safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function GET(){const auth=await safeExitApiActor(["VIEW_LIVE_CAMPUS_ROSTER"]);if(auth.response||!auth.actor)return auth.response;try{return safeExitJson({roster:await liveCampusRoster(prisma,auth.actor)});}catch(error){return safeExitApiError(error);}}
