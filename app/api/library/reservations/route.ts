import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createLibraryReservation, libraryReservationQueue } from "@/lib/library-reservations";
import { publicLibraryReservation } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_LIBRARY_CIRCULATION"); if (auth.response) return auth.response; const reservations = await libraryReservationQueue(prisma, request.nextUrl.searchParams.get("titleId") ?? undefined); return NextResponse.json({ reservations: reservations.map(publicLibraryReservation) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_LIBRARY_RESERVATIONS"); if (auth.response) return auth.response; try { return NextResponse.json({ reservation: publicLibraryReservation(await createLibraryReservation(prisma, await request.json(), auth.user.id)) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create reservation") }, { status: 400 }); } }
