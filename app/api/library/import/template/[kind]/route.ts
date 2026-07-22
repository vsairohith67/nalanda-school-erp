import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { libraryImportTemplate } from "@/lib/library-import";
export async function GET(_request: NextRequest, context: { params: Promise<{ kind: string }> }) { const auth = await requireApiPermission("IMPORT_LIBRARY_CATALOG"); if (auth.response) return auth.response; const { kind } = await context.params; if (kind !== "titles" && kind !== "copies") return NextResponse.json({ error: "Unsupported template" }, { status: 404 }); return new NextResponse(libraryImportTemplate(kind), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=library-${kind}-template.csv` } }); }
