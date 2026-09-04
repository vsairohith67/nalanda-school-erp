import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activationFeatureUnavailable, activationJson } from "@/lib/real-user-access/activation-api";
import { realUserAccessDashboard } from "@/lib/real-user-access/dashboard";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export async function GET(){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))return activationFeatureUnavailable();const auth=await requireApiPermission("VIEW_IAM_ACCESS");if(auth.response)return auth.response;return activationJson({dashboard:await realUserAccessDashboard(prisma)});}
