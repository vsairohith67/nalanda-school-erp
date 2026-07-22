import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cancelLibraryLoan } from "@/lib/library-circulation";
import { publicLibraryLoan } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("ISSUE_LIBRARY_BOOKS"); if (auth.response) return auth.response; try { const body = await request.json(); return NextResponse.json({ loan: publicLibraryLoan(await cancelLibraryLoan(prisma, (await params).id, String(body.reason ?? ""), auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to cancel loan") }, { status: 400 }); } }
