import { NextRequest } from "next/server";
import { duplicateSuggestions, resolveDuplicate } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function GET(_: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["VIEW_ADMISSIONS", "MANAGE_ADMISSION_APPLICATIONS"]); if (auth.response) return auth.response; try { return admissionsJson(await duplicateSuggestions(prisma, (await context.params).publicKey)); } catch (error) { return admissionsError(error); } }
export async function POST(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_APPLICATIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson({ resolution: await resolveDuplicate(prisma, (await context.params).publicKey, await admissionsBody(request), auth.user) }, 201); } catch (error) { return admissionsError(error); } }
