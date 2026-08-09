import { prisma } from "@/lib/prisma";
import { listSafeExitRequests } from "@/lib/safe-exit";
import { safeExitApiActor, safeExitApiError, safeExitJson } from "@/lib/safe-exit-api";
export async function GET(_request:Request,context:{params:Promise<{requestKey:string}>}){const auth=await safeExitApiActor(["REQUEST_STUDENT_DEPARTURE","VERIFY_GATE_PASS","VIEW_DEPARTURE_AUDIT"]);if(auth.response||!auth.actor)return auth.response;try{const key=(await context.params).requestKey,row=(await listSafeExitRequests(prisma,auth.actor)).find((item:any)=>item.requestKey===key);return row?safeExitJson({request:row}):safeExitJson({error:"Student departure request was not found."},404);}catch(error){return safeExitApiError(error);}}
