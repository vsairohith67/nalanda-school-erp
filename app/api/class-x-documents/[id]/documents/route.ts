import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  const items = await prisma.classXPackageDocumentItem.findMany({ where: { packageId: (await params).id }, orderBy: { displayOrder: "asc" } });
  return NextResponse.json({ items });
}
