import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordCafeteriaMeal } from "@/lib/cafeteria";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson, parseOptionalOperationsJson } from "@/lib/optional-operations-api";
export async function POST(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson({meal:await recordCafeteriaMeal(prisma,auth.actor,await parseOptionalOperationsJson(request))},201);}catch(error){return optionalOperationsApiError(error);}}
