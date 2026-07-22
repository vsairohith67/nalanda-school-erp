import { notFound } from "next/navigation";
import { PublicBlocks } from "@/components/public-website";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicSettings } from "@/lib/public-website-content";
import { parsePublicWebsiteBlocks } from "@/lib/public-website-blocks";
export const dynamic="force-dynamic";export const metadata={robots:{index:false,follow:false}};
export default async function PagePreview({params}:{params:Promise<{id:string}>}){await requirePermission("PREVIEW_PUBLIC_WEBSITE_DRAFTS");const{id}=await params;const[page,settings]=await Promise.all([prisma.publicWebsitePage.findUnique({where:{id}}),getPublishedPublicSettings(prisma)]);if(!page)notFound();await prisma.publicWebsiteEvent.create({data:{entityType:"PAGE",entityId:id,eventType:"PREVIEW_ACCESSED"}});return <div className="website-draft-preview"><div className="draft-watermark">LEADERSHIP DRAFT · NOT PUBLIC · NOINDEX</div><PublicBlocks blocks={parsePublicWebsiteBlocks(page.draftContentJson)} settings={settings}/></div>;}
