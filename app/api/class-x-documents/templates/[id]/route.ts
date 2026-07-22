import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { validateClassXTemplateDefinition } from "@/lib/class-x-package-templates";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CONFIGURE_CLASS_X_PACKAGE_TEMPLATES"); if (auth.response) return auth.response;
  try {
    const id = (await params).id, body = await request.json(), old = await prisma.classXPackageTemplate.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const status = body.status && ["DRAFT", "ACTIVE", "INACTIVE"].includes(String(body.status).toUpperCase()) ? String(body.status).toUpperCase() : old.status;
    const definition = body.documentDefinition || body.documentDefinitionJson ? validateClassXTemplateDefinition(body.documentDefinition ?? body.documentDefinitionJson) : null;
    const row = await prisma.classXPackageTemplate.update({ where: { id }, data: { ...(body.name ? { name: String(body.name).trim() } : {}), status, ...(definition ? { documentDefinitionJson: JSON.stringify(definition), versionNumber: { increment: 1 } } : {}), activatedByUserId: status === "ACTIVE" ? auth.user.id : old.activatedByUserId } });
    return NextResponse.json({ template: row });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update template") }, { status: 400 }); }
}
