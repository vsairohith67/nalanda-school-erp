import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cancelLibraryReservation } from "@/lib/library-reservations";
import { publicLibraryReservation } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("MANAGE_LIBRARY_RESERVATIONS"); if (auth.response) return auth.response; try { const body = await request.json(); return NextResponse.json({ reservation: publicLibraryReservation(await cancelLibraryReservation(prisma, (await params).id, String(body.reason ?? ""), auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to cancel reservation") }, { status: 400 }); } }
