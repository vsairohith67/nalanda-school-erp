import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { previewClassXCharge } from "@/lib/class-x-package-payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  try { const body = await request.json(), template = body.templateId ? await prisma.classXPackageTemplate.findUnique({ where: { id: String(body.templateId) } }) : null; return NextResponse.json({ preview: await previewClassXCharge(prisma, String(body.academicYear ?? ""), template?.defaultChargeRuleId) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to preview package charge") }, { status: 400 }); }
}
