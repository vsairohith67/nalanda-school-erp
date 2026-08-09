import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManualSupportRequest, listManagedSupportRequests, validateManualSupportInput } from "@/lib/support";
import { parseJsonBody, supportActor, supportApiError, supportJson } from "@/lib/support-api";

export async function GET() { const auth = await requireApiPermission("VIEW_SUPPORT_REQUESTS"); if (auth.response || !auth.user) return auth.response; try { return supportJson({ requests: await listManagedSupportRequests(prisma, await supportActor(auth.user)) }); } catch (error) { return supportApiError(error); } }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("RECORD_IN_PERSON_SUPPORT"); if (auth.response || !auth.user) return auth.response; try { return supportJson({ request: await createManualSupportRequest(prisma, await supportActor(auth.user), validateManualSupportInput(await parseJsonBody(request))) }, 201); } catch (error) { return supportApiError(error); } }
