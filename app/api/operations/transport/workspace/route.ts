import { prisma } from "@/lib/prisma";
import { optionalOperationsActor, optionalOperationsApiError, optionalOperationsJson } from "@/lib/optional-operations-api";
import { transportWorkspace } from "@/lib/transport";
export async function GET(){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{return optionalOperationsJson(await transportWorkspace(prisma,auth.actor));}catch(error){return optionalOperationsApiError(error);}}
