import { NextRequest } from "next/server";
import { admissionsError, admissionsJson, invitationToken } from "@/lib/admissions-api";
import { uploadApplicationDocument } from "@/lib/admissions-files";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) { try { if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return admissionsJson({ error: "Use multipart form data." }, 415); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) return admissionsJson({ error: "Choose a document." }, 400); const document = await uploadApplicationDocument(prisma, { invitationToken: invitationToken(request), documentType: String(form.get("documentType") ?? ""), file }); return admissionsJson({ document }, 201); } catch (error) { return admissionsError(error); } }
