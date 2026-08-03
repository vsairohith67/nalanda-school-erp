import { NextRequest } from "next/server";
import { appendEnquiryInteraction } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_ENQUIRIES"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await appendEnquiryInteraction(prisma, (await context.params).publicKey, await admissionsBody(request), auth.user)); } catch (error) { return admissionsError(error); } }
