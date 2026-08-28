import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processDueCloudBackups, retryEligibleCloudBackups } from "@/lib/cloud-backup-worker";

export async function POST() {
  const auth = await requireApiPermission("RUN_CLOUD_BACKUP"); if (auth.response) return auth.response;
  if (new Set(["synthetic-staging", "staging", "production"]).has((process.env.NALANDA_ENVIRONMENT || "").toLowerCase())
    && (process.env.PORTABLE_BACKUP_DESTINATION || "").toUpperCase() === "S3_COMPATIBLE_PRIVATE") {
    return NextResponse.json({ queued: true, worker: "portable-backup-worker" }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  }
  const retries = await retryEligibleCloudBackups(prisma);
  const due = await processDueCloudBackups(prisma);
  return NextResponse.json({ retries, due }, { headers: { "Cache-Control": "private, no-store" } });
}
