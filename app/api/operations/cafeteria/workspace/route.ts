import { prisma } from "@/lib/prisma";
import { cafeteriaWorkspace } from "@/lib/cafeteria";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson } from "@/lib/optional-operations-api";
export async function GET(){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson(await cafeteriaWorkspace(prisma,auth.actor));}catch(error){return optionalOperationsApiError(error);}}
