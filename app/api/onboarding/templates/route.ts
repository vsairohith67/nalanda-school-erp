import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOnboardingTemplate } from "@/lib/onboarding-workbooks";
import { isOnboardingBundle, ONBOARDING_PRIVATE_HEADERS } from "@/lib/onboarding-types";
import { onboardingError } from "@/lib/onboarding-api";
import { OnboardingError } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("DOWNLOAD_ONBOARDING_TEMPLATE"); if (auth.response) return auth.response;
  try {
    const bundle = request.nextUrl.searchParams.get("bundle"); if (!isOnboardingBundle(bundle)) throw new OnboardingError("Select a supported onboarding bundle.");
    const [classes, departments, designations] = await Promise.all([
      prisma.timetableClassSection.findMany({ where: { isActive: true }, select: { academicYear: true, className: true, section: true, displayName: true }, orderBy: [{ academicYear: "asc" }, { className: "asc" }, { section: "asc" }] }),
      prisma.staffMember.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"], orderBy: { department: "asc" } }),
      prisma.staffMember.findMany({ select: { designation: true }, distinct: ["designation"], orderBy: { designation: "asc" } })
    ]);
    const bytes = generateOnboardingTemplate({ bundle, academicYears: [...new Set(classes.map((r) => r.academicYear))], classes, departments: departments.map((r) => r.department!).filter(Boolean), designations: designations.map((r) => r.designation).filter(Boolean) });
    return new NextResponse(bytes, { headers: { ...ONBOARDING_PRIVATE_HEADERS, "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=nalanda-${bundle.toLowerCase().replaceAll("_", "-")}-onboarding-v1.xlsx`, "content-length": String(bytes.length) } });
  } catch (error) { return onboardingError(error); }
}
