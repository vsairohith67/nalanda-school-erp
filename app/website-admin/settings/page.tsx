import { PageHeader } from "@/components/ui";
import { WebsiteSettingsForm } from "@/components/website-admin-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function WebsiteSettingsPage(){await requirePermission("MANAGE_PUBLIC_WEBSITE_SETTINGS");const settings=await prisma.publicWebsiteSettings.findFirst({orderBy:{updatedAt:"desc"}});return <div className="page website-admin-page"><PageHeader title="Public Website Settings" description="Verified public contact, brand, default SEO and the fixed portal-login entry. No DNS or hosting credentials."/><WebsiteSettingsForm settings={settings}/></div>;}
