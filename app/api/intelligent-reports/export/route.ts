import { handle, json, HEADERS as PRIVATE_HEADERS } from "@/lib/intelligent-reports/api";
import { getCurrentAuthContext } from "@/lib/auth";
import type { NextRequest } from "next/server";
export async function POST(request:NextRequest){
  // Explicit transport guard; handle independently reauthorizes the live session,
  // module, domain, export permission and source revision before reading data.
  let auth;
  try { auth = await getCurrentAuthContext(); }
  catch { return json({error:"The report could not be completed safely. Please retry after checking the source.",code:"REPORT_UNAVAILABLE"},500); }
  if(!auth)return json({error:"Sign in to use Ask Nalanda.",code:"AUTH_REQUIRED"},401);
  const response=await handle(request,"export");
  for(const [key,value] of Object.entries(PRIVATE_HEADERS))response.headers.set(key,value);
  return response;
}
