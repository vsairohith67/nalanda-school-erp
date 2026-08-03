import { admissionsError, admissionsJson, requireAdmissionsAny } from "@/lib/admissions-api";
import { retentionPreview } from "@/lib/admissions";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireAdmissionsAny(["MANAGE_ADMISSION_RETENTION"]); if (auth.response) return auth.response; try { return admissionsJson(await retentionPreview(prisma)); } catch (error) { return admissionsError(error); } }
