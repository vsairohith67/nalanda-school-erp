import { PublicFooter, PublicHeader } from "@/components/public-website";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicSettings, listPublicNavigation } from "@/lib/public-website-content";
import { buildPublicSchoolStructuredData } from "@/lib/public-website-seo";

export const dynamic = "force-dynamic";

export default async function PublicWebsiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation] = await Promise.all([getPublishedPublicSettings(prisma), listPublicNavigation(prisma)]);
  const structuredData = JSON.stringify(buildPublicSchoolStructuredData(settings)).replaceAll("<", "\\u003c");
  return <div className="public-site"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} /><a className="public-skip-link" href="#public-main">Skip to main content</a><PublicHeader settings={settings} navigation={navigation} /><main id="public-main" tabIndex={-1}>{children}</main><PublicFooter settings={settings} navigation={navigation} /></div>;
}
