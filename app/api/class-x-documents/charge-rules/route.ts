import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { assertClassXIncomeItem, validateClassXChargeRuleInput } from "@/lib/class-x-package-templates";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  return NextResponse.json({ rules: await prisma.classXPackageChargeRule.findMany({ orderBy: [{ status: "asc" }, { academicYear: "desc" }, { name: "asc" }] }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CONFIGURE_CLASS_X_PACKAGE_CHARGES"); if (auth.response) return auth.response;
  try { const data = validateClassXChargeRuleInput(await request.json()); await assertClassXIncomeItem(prisma, data.miscellaneousIncomeItemCode); const row = await prisma.classXPackageChargeRule.create({ data: { ...data, createdByUserId: auth.user.id } }); return NextResponse.json({ rule: row }, { status: 201 }); }
  catch (error: any) { return NextResponse.json({ error: error?.code === "P2002" ? "Charge rule code already exists" : safeClientError(error, "Unable to create charge rule") }, { status: 400 }); }
}
