import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { serializeExpense } from "@/lib/expenses";
import { createLibraryManagementServiceDraft } from "@/lib/publisher-bills";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_PUBLISHER_BILLS"); if (auth.response) return auth.response; try { const expense = await createLibraryManagementServiceDraft(prisma, await request.json(), auth.user); return NextResponse.json({ expense: serializeExpense(expense), payrollUsed: false }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create library-management service expense") }, { status: 400 }); } }
