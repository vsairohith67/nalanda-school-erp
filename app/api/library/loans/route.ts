import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { deriveOverdue } from "@/lib/library-circulation";
import { safeMemberLabel } from "@/lib/library-members";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_LIBRARY_CIRCULATION"); if (auth.response) return auth.response; const status = request.nextUrl.searchParams.get("status"); const rows = await prisma.libraryLoan.findMany({ where: status ? { status } : undefined, include: { member: { include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } } }, copy: { include: { title: true } } }, orderBy: { issueDate: "desc" } }); return NextResponse.json({ loans: rows.map((row) => ({ loanNumber: row.loanNumber, status: row.status, issueDate: row.issueDate, dueDate: row.dueDate, returnedDate: row.returnedDate, renewCount: row.renewCount, borrower: safeMemberLabel(row.member), accessionNumber: row.copy.accessionNumber, titleCode: row.copy.title.titleCode, title: row.copy.title.title, ...deriveOverdue(row) })) }); }
