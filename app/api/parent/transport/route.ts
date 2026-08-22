import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson } from "@/lib/optional-operations-api";
import { parentTransportView } from "@/lib/transport";
export async function GET(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson(await parentTransportView(prisma,auth.actor,request.nextUrl.searchParams.get("admissionNo")));}catch(error){return optionalOperationsApiError(error);}}
