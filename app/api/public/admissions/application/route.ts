import { NextRequest } from "next/server";
import { loadInvitedApplication, saveInvitedApplication } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, invitationToken } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { try { return admissionsJson({ application: await loadInvitedApplication(prisma, invitationToken(request)) }); } catch (error) { return admissionsError(error); } }
export async function PATCH(request: NextRequest) { try { return admissionsJson(await saveInvitedApplication(prisma, invitationToken(request), await admissionsBody(request), false)); } catch (error) { return admissionsError(error); } }
export async function POST(request: NextRequest) { try { return admissionsJson(await saveInvitedApplication(prisma, invitationToken(request), await admissionsBody(request), true)); } catch (error) { return admissionsError(error); } }
