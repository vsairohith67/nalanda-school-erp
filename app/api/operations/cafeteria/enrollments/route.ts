import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { deactivateCafeteriaEnrollment, enrollCafeteriaStudent } from "@/lib/cafeteria";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson, parseOptionalOperationsJson } from "@/lib/optional-operations-api";
export async function POST(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson({enrollment:await enrollCafeteriaStudent(prisma,auth.actor,await parseOptionalOperationsJson(request))},201);}catch(error){return optionalOperationsApiError(error);}}
export async function PATCH(request:NextRequest){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson({enrollment:await deactivateCafeteriaEnrollment(prisma,auth.actor,await parseOptionalOperationsJson(request))});}catch(error){return optionalOperationsApiError(error);}}
