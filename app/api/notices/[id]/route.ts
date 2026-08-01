import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateNoticeInput } from "@/lib/notices";


const staffInclude = {
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } }
} as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const source = await request.json().catch(() => ({}));
  const action = typeof source.action === "string" ? source.action : "save";
  const requiredPermission = action === "publish" || source.status === "PUBLISHED"
    ? "PUBLISH_NOTICES"
    : "MANAGE_NOTICES";
  const auth = await requireApiPermission(requiredPermission);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  if (action === "save" && existing.status === "PUBLISHED" &&
      !(await hasUserPermission(auth.user, "PUBLISH_NOTICES"))) {
    return NextResponse.json({ error: "Publishing permission is required to change a published notice" }, { status: 403 });
  }

  try {
    if (action === "publish") {
      const publishDate = existing.publishDate ?? new Date();
      if (existing.expiresAt && existing.expiresAt <= publishDate) {
        return NextResponse.json({ error: "Expiry date must be later than the publish date" }, { status: 400 });
      }
      const notice = await prisma.notice.update({
        where: { id },
        data: { status: "PUBLISHED", publishDate, updatedById: auth.user.id },
        include: staffInclude
      });
      return NextResponse.json({ notice });
    }
    if (action === "archive") {
      const notice = await prisma.notice.update({
        where: { id },
        data: { status: "ARCHIVED", updatedById: auth.user.id },
        include: staffInclude
      });
      return NextResponse.json({ notice });
    }
    const input = validateNoticeInput(source);
    const status = source.status === "DRAFT" || source.status === "PUBLISHED" ? source.status : existing.status;
    const publishDate = status === "PUBLISHED" ? input.publishDate ?? existing.publishDate ?? new Date() : input.publishDate;
    if (status === "PUBLISHED" && input.expiresAt && input.expiresAt <= publishDate!) {
      throw new Error("Expiry date must be later than the publish date.");
    }
    const notice = await prisma.notice.update({
      where: { id },
      data: {
        ...input,
        status,
        publishDate,
        updatedById: auth.user.id
      },
      include: staffInclude
    });
    return NextResponse.json({ notice });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to update notice") }, { status: 400 });
  }
}
