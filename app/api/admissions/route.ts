import { NextRequest } from "next/server";
import { createAdmissionCycle, listAdmissionsWorkspace } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireAdmissionsAny(["VIEW_ADMISSIONS", "REVIEW_ADMISSION_APPLICATIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await listAdmissionsWorkspace(prisma, auth.user, { status: request.nextUrl.searchParams.get("status") ?? undefined, academicYear: request.nextUrl.searchParams.get("academicYear") ?? undefined })); } catch (error) { return admissionsError(error); } }
export async function POST(request: NextRequest) { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_APPLICATIONS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson({ cycle: await createAdmissionCycle(prisma, await admissionsBody(request), auth.user) }, 201); } catch (error) { return admissionsError(error); } }
