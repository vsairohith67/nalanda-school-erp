import { NextRequest } from "next/server";
import { createPublicEnquiry, validatePublicEnquiry } from "@/lib/admissions";
import { admissionsBody, admissionsJson } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";

const GENERIC = { accepted: true, message: "Thank you. If appropriate, the school admissions team will follow up using the contact provided." };
export async function POST(request: NextRequest) { try { const input = validatePublicEnquiry(await admissionsBody(request)); const evidence = [request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "local", request.headers.get("user-agent")?.slice(0, 120) ?? "unknown"].join("|"); await createPublicEnquiry(prisma, input, evidence); } catch {} return admissionsJson(GENERIC, 202); }
