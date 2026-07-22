import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffNoticeWhere, validateNoticeInput } from "@/lib/notices";
import { hasRolePermission } from "@/lib/role-permissions";

const staffInclude = {
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } }
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_NOTICES");
  if (auth.response) return auth.response;
  const notices = await prisma.notice.findMany({
    where: staffNoticeWhere({
      status: request.nextUrl.searchParams.get("status"),
      audienceType: request.nextUrl.searchParams.get("audience")
    }),
    include: staffInclude,
    orderBy: [{ updatedAt: "desc" }]
  });
  return NextResponse.json({ notices });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_NOTICES");
  if (auth.response) return auth.response;
  try {
    const source = await request.json();
    const input = validateNoticeInput(source);
    const requestedStatus = source.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    if (requestedStatus === "PUBLISHED" && !(await hasRolePermission(prisma, auth.user.role, "PUBLISH_NOTICES"))) {
      return NextResponse.json({ error: "You do not have permission to publish notices" }, { status: 403 });
    }
    const effectivePublishDate = requestedStatus === "PUBLISHED" ? input.publishDate ?? new Date() : input.publishDate;
    if (requestedStatus === "PUBLISHED" && input.expiresAt && input.expiresAt <= effectivePublishDate!) {
      throw new Error("Expiry date must be later than the publish date.");
    }
    const notice = await prisma.notice.create({
      data: {
        ...input,
        status: requestedStatus,
        publishDate: effectivePublishDate,
        createdById: auth.user.id,
        updatedById: auth.user.id
      },
      include: staffInclude
    });
    return NextResponse.json({ notice }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to create notice") }, { status: 400 });
  }
}

function message(error: unknown, fallback: string) {
  return safeClientError(error, fallback);
}
