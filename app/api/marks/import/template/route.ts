import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { marksImportTemplate } from "@/lib/marks-import";
export async function GET() { const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response) return auth.response; return new NextResponse(marksImportTemplate(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=marks-import-template.csv" } }); }
