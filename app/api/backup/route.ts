import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { formatBackupFilename, generateFullBackup, serializeBackup } from "@/lib/backup";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRolePermissions } from "@/lib/role-permissions";

export async function GET() {
  const auth = await requireApiPermission("RUN_BACKUP");
  if (auth.response) return auth.response;

  try {
    const generatedAt = new Date();
    await ensureDefaultRolePermissions(prisma);
    const backup = await generateFullBackup(prisma, {
      generatedAt,
      generatedBy: `${auth.user.name} (${auth.user.username})`
    });

    return new NextResponse(serializeBackup(backup), {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${formatBackupFilename(generatedAt)}"`
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Backup could not be created. Check database access and available disk space, then try again." },
      { status: 500 }
    );
  }
}
