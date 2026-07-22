import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { STAFF_IMPORT_COLUMNS } from "@/lib/staff";
export async function GET() { const auth = await requireApiPermission("IMPORT_STAFF"); if (auth.response) return auth.response; const sample = ["T-001","Sample Teacher","TEACHING","Teacher","Academics","Mathematics","Science","B.Ed","5","2024-06-01","9876543210","","teacher@example.com","ACTIVE","Remove this sample row before import"]; const csv = `${STAFF_IMPORT_COLUMNS.join(",")}\n${sample.join(",")}\n`; return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=staff-import-template.csv" } }); }
