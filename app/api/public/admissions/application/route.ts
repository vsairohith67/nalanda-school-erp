import { NextRequest } from "next/server";
import { loadInvitedApplication, saveInvitedApplication } from "@/lib/admissions";
import { admissionsBody, admissionsError, admissionsJson, invitationToken } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ADMISSIONS_FORM_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";
export async function GET(request: NextRequest) { const featureUnavailable = requireOperationalReleaseFeatureForApi(PUBLIC_ADMISSIONS_FORM_FEATURE); if (featureUnavailable) return featureUnavailable; try { return admissionsJson({ application: await loadInvitedApplication(prisma, invitationToken(request)) }); } catch (error) { return admissionsError(error); } }
export async function PATCH(request: NextRequest) { const featureUnavailable = requireOperationalReleaseFeatureForApi(PUBLIC_ADMISSIONS_FORM_FEATURE); if (featureUnavailable) return featureUnavailable; try { return admissionsJson(await saveInvitedApplication(prisma, invitationToken(request), await admissionsBody(request), false)); } catch (error) { return admissionsError(error); } }
export async function POST(request: NextRequest) { const featureUnavailable = requireOperationalReleaseFeatureForApi(PUBLIC_ADMISSIONS_FORM_FEATURE); if (featureUnavailable) return featureUnavailable; try { return admissionsJson(await saveInvitedApplication(prisma, invitationToken(request), await admissionsBody(request), true)); } catch (error) { return admissionsError(error); } }
