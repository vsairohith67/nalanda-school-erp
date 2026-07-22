import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { validateClassXTemplateInput } from "@/lib/class-x-package-templates";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  return NextResponse.json({ templates: await prisma.classXPackageTemplate.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CONFIGURE_CLASS_X_PACKAGE_TEMPLATES"); if (auth.response) return auth.response;
  try { const data = validateClassXTemplateInput(await request.json()); const row = await prisma.classXPackageTemplate.create({ data: { ...data, createdByUserId: auth.user.id, activatedByUserId: data.status === "ACTIVE" ? auth.user.id : null } }); return NextResponse.json({ template: row }, { status: 201 }); }
  catch (error: any) { return NextResponse.json({ error: error?.code === "P2002" ? "Template code already exists" : safeClientError(error, "Unable to create template") }, { status: 400 }); }
}
