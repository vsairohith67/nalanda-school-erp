import { PageHeader } from "@/components/ui";
import { WebsiteNavigationForm } from "@/components/website-admin-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function WebsiteNavigationPage(){await requirePermission("MANAGE_PUBLIC_WEBSITE_NAVIGATION");const rows=await prisma.publicWebsiteNavigationItem.findMany({orderBy:[{displayOrder:"asc"},{itemCode:"asc"}]});const initial=rows.map(row=>({itemCode:row.itemCode,label:row.label,destinationType:row.destinationType,pageId:row.pageId,safeExternalUrl:row.safeExternalUrl,displayOrder:row.displayOrder,placement:row.placement,enabled:row.enabled,opensNewTab:row.opensNewTab}));return <div className="page website-admin-page"><PageHeader title="Public Navigation" description="Deterministic links to published public pages, news, /login or explicitly approved HTTPS destinations."/><WebsiteNavigationForm initial={initial}/></div>;}
