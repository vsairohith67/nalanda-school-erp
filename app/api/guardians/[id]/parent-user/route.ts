import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { createParentUserFromGuardian, linkExistingParentUser } from "@/lib/guardians";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (body.action === "link-existing") {
      const user = await linkExistingParentUser(prisma, id, String(body.username ?? ""));
      return NextResponse.json({ user });
    }
    const user = await prisma.$transaction((tx) => createParentUserFromGuardian(tx, id, {
        username: String(body.username ?? ""),
        email: body.email ? String(body.email) : null,
        password: String(body.password ?? "")
      }));
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to prepare parent login") },
      { status: 400 }
    );
  }
}
