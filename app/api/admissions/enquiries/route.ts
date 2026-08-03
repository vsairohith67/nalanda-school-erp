import { NextRequest } from "next/server";
import { createStaffEnquiry } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_ENQUIRIES"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson({ enquiry: await createStaffEnquiry(prisma, await admissionsBody(request), auth.user) }, 201); } catch (error) { return admissionsError(error); } }
