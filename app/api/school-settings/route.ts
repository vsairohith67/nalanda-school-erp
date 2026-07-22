import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { getSchoolSettings, validateSchoolSettings } from "@/lib/school-settings";
import { logUserAction } from "@/lib/user-audit";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_SCHOOL_SETTINGS");
  if (auth.response) return auth.response;
  return NextResponse.json(await getSchoolSettings(prisma));
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_SCHOOL_SETTINGS");
  if (auth.response) return auth.response;
  try {
    const data = validateSchoolSettings(await request.json());
    const settings = await prisma.$transaction(async (tx) => {
      const result = await tx.schoolSettings.upsert({
        where: { id: "school" },
        update: data,
        create: { id: "school", ...data }
      });
      await logUserAction(tx, {
        action: "SCHOOL_SETTINGS_CHANGED",
        actor: auth.user,
        details: { academicYear: result.academicYear, schoolName: result.schoolName }
      });
      return result;
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to save school settings") },
      { status: 400 }
    );
  }
}
