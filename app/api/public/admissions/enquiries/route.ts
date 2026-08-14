import { NextRequest } from "next/server";
import { createPublicEnquiry, publicAdmissionIntakeAvailable, validatePublicEnquiry } from "@/lib/admissions";
import { admissionsBody, admissionsJson } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
import { loginRequestSource } from "@/lib/auth-rate-limit";

const GENERIC = { accepted: true, message: "Thank you. If appropriate, the school admissions team will follow up using the contact provided." };
export async function POST(request: NextRequest) { try { if (await publicAdmissionIntakeAvailable(prisma)) { const input = validatePublicEnquiry(await admissionsBody(request)); await createPublicEnquiry(prisma, input, loginRequestSource(request.headers)); } } catch {} return admissionsJson(GENERIC, 202); }
