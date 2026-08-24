import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCafeteriaMenu, updateCafeteriaMenu } from "@/lib/cafeteria";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson, parseOptionalOperationsJson } from "@/lib/optional-operations-api";
export async function POST(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson({menu:await createCafeteriaMenu(prisma,auth.actor,await parseOptionalOperationsJson(request))},201);}catch(error){return optionalOperationsApiError(error);}}
export async function PATCH(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson({menu:await updateCafeteriaMenu(prisma,auth.actor,await parseOptionalOperationsJson(request))});}catch(error){return optionalOperationsApiError(error);}}
