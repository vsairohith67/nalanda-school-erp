import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { marksImportTemplate } from "@/lib/marks-import";
import { resolveMarksWriteAuthority } from "@/lib/academic-integrity";
import { resolveMarksScope } from "@/lib/marks-scope";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response || !auth.user) return auth.response; try { await resolveMarksWriteAuthority(prisma, auth.user); const scope = await resolveMarksScope(prisma, auth.user, undefined, "WRITE"); if (!scope.broad && !scope.targets.length) throw new Error("No legacy import scope"); return new NextResponse(marksImportTemplate(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=marks-import-template.csv" } }); } catch { return NextResponse.json({ error: "You do not have an active legacy marks-import scope." }, { status: 403 }); } }
