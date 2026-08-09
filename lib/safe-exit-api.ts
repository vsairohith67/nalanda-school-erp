import { NextResponse } from "next/server";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { SafeExitError, type SafeExitActor } from "@/lib/safe-exit";

export const SAFE_EXIT_PRIVATE_HEADERS={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Vary":"Cookie"};
export function safeExitJson(body:unknown,status=200){return NextResponse.json(body,{status,headers:SAFE_EXIT_PRIVATE_HEADERS});}
export function safeExitApiError(error:unknown){if(error instanceof SafeExitError)return safeExitJson({error:error.message,code:error.code},error.status);const message=error instanceof Error&&/Re-authentication|Authorization changed/.test(error.message)?error.message:null;return safeExitJson({error:message??"Unable to complete the Student safety action.",code:message?"REAUTHENTICATION_REQUIRED":"SAFE_EXIT_FAILED"},message?403:500);}
export async function parseSafeExitJson(request:Request){const type=request.headers.get("content-type")?.split(";",1)[0]?.trim().toLowerCase();if(type!=="application/json")throw new SafeExitError("Content type must be application/json.",415,"CONTENT_TYPE_REQUIRED");try{return await request.json();}catch{throw new SafeExitError("A valid JSON request body is required.",400,"INVALID_JSON");}}
export async function safeExitApiActor(requiredAny:string[]=[]):Promise<
  | { actor: SafeExitActor; response?: never }
  | { actor?: never; response: NextResponse }
>{const context=await getCurrentAuthContext();if(!context)return{response:safeExitJson({error:"Authentication required"},401)};const permissions=await getCurrentUserEffectivePermissions();if(requiredAny.length&&!requiredAny.some((permission)=>permissions.has(permission as any)))return{response:safeExitJson({error:"You do not have permission for this Student safety action."},403)};return{actor:{user:context.user,sessionId:context.sessionId,permissions}};}
