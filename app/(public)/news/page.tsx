import type { Metadata } from "next";
import { PublicNewsGrid } from "@/components/public-website";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicSettings, listActivePublicPosts } from "@/lib/public-website-content";
import { buildPublicMetadata } from "@/lib/public-website-seo";
export async function generateMetadata(): Promise<Metadata> { const settings = await getPublishedPublicSettings(prisma); return buildPublicMetadata({ title: "School news | Nalanda Public School", description: "Read leadership-reviewed public news and announcements from Nalanda Public School. Private notices and communication campaigns are never copied here.", canonicalPath: "/news", socialImageKey: "NALANDA_LOGO" }, settings.publicSiteUrl); }
export default async function NewsPage() { return <PublicNewsGrid posts={await listActivePublicPosts(prisma)} heading="Published news and announcements" headingLevel="h1" />; }
