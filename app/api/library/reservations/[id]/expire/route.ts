import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { expireLibraryReservation } from "@/lib/library-reservations";
import { publicLibraryReservation } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("MANAGE_LIBRARY_RESERVATIONS"); if (auth.response) return auth.response; try { return NextResponse.json({ reservation: publicLibraryReservation(await expireLibraryReservation(prisma, (await params).id, auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to expire reservation") }, { status: 400 }); } }
