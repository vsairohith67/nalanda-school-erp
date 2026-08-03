import { NextRequest } from "next/server";
import { reviewOrDecideApplication } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["REVIEW_ADMISSION_APPLICATIONS", "MANAGE_ADMISSION_APPLICATIONS", "DECIDE_ADMISSIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await reviewOrDecideApplication(prisma, (await context.params).publicKey, await admissionsBody(request), auth.user)); } catch (error) { return admissionsError(error); } }
