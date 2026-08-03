import { NextRequest } from "next/server";
import { issueApplicationInvitation } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_APPLICATIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await issueApplicationInvitation(prisma, (await context.params).publicKey, await admissionsBody(request), auth.user), 201); } catch (error) { return admissionsError(error); } }
