import { NextRequest } from "next/server";
import { convertAdmission } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["CONVERT_ADMISSIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await convertAdmission(prisma, (await context.params).publicKey, await admissionsBody(request), auth.user)); } catch (error) { return admissionsError(error); } }
