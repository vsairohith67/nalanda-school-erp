import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CONFIGURE_CLASS_X_PACKAGE_CHARGES"); if (auth.response) return auth.response;
  try { const body = await request.json(), status = String(body.status ?? "").toUpperCase(); if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error("Rule status is not supported"); return NextResponse.json({ rule: await prisma.classXPackageChargeRule.update({ where: { id: (await params).id }, data: { status } }) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update charge rule") }, { status: 400 }); }
}
