import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { guardianImportTemplateCsv } from "@/lib/guardians";

export async function GET() {
  const auth = await requireApiPermission("IMPORT_GUARDIANS");
  if (auth.response) return auth.response;
  return new NextResponse(guardianImportTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="guardian-link-template.csv"'
    }
  });
}
