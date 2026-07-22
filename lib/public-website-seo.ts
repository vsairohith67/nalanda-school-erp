import type { Metadata } from "next";
import { getPublicWebsiteAsset } from "@/lib/public-website-assets";
import { safePublicUrl } from "@/lib/public-website-links";

export type PublicWebsiteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  socialImageKey?: string;
};

export function validatePublicWebsiteSeo(input: unknown): PublicWebsiteSeo {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("SEO settings are required.");
  const source = input as Record<string, unknown>;
  const title = String(source.title ?? "").trim();
  const description = String(source.description ?? "").trim();
  const canonicalPath = safePublicUrl(source.canonicalPath ?? "/");
  if (title.length < 10 || title.length > 70) throw new Error("SEO title must contain 10 to 70 characters.");
  if (description.length < 50 || description.length > 170) throw new Error("SEO description must contain 50 to 170 characters.");
  const socialImageKey = String(source.socialImageKey ?? "").trim() || undefined;
  if (socialImageKey) getPublicWebsiteAsset(socialImageKey);
  return { title, description, canonicalPath, socialImageKey };
}

export function parsePublicWebsiteSeo(json: string) {
  try {
    return validatePublicWebsiteSeo(JSON.parse(json));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "SEO settings are invalid.");
  }
}

export function publicWebsiteBaseUrl(configured?: string | null) {
  const candidate = String(process.env.PUBLIC_WEBSITE_URL || configured || "http://localhost:3000").trim();
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return new URL("/", url).toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

export function publicWebsiteIndexingEnabled(configured?: string | null) {
  const base = publicWebsiteBaseUrl(configured);
  return process.env.PUBLIC_WEBSITE_INDEXING_ENABLED === "true" && /^https:\/\/(www\.)?nalandaps\.com$/i.test(base);
}

export function buildPublicMetadata(seo: PublicWebsiteSeo, configuredUrl?: string | null): Metadata {
  const base = publicWebsiteBaseUrl(configuredUrl);
  const image = getPublicWebsiteAsset(seo.socialImageKey ?? "NALANDA_LOGO");
  const canonical = new URL(seo.canonicalPath, `${base}/`).toString();
  const indexable = publicWebsiteIndexingEnabled(configuredUrl);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", title: seo.title, description: seo.description, url: canonical, images: [{ url: new URL(image.src, `${base}/`).toString(), width: image.width, height: image.height, alt: image.altPolicy }] },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: [new URL(image.src, `${base}/`).toString()] }
  };
}

export function buildPublicSchoolStructuredData(settings: {
  siteName: string;
  publicSiteUrl: string | null;
  publicAddress: string | null;
  publicOfficePhone: string | null;
  publicOfficeEmail: string | null;
  publicOfficeHours: string | null;
}) {
  const base = publicWebsiteBaseUrl(settings.publicSiteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "School",
    name: settings.siteName,
    url: base,
    logo: new URL("/nalanda-logo.jpg", `${base}/`).toString(),
    ...(settings.publicAddress ? { address: { "@type": "PostalAddress", streetAddress: settings.publicAddress } } : {}),
    ...(settings.publicOfficePhone || settings.publicOfficeEmail || settings.publicOfficeHours ? {
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "school office",
        ...(settings.publicOfficePhone ? { telephone: settings.publicOfficePhone } : {}),
        ...(settings.publicOfficeEmail ? { email: settings.publicOfficeEmail } : {}),
        ...(settings.publicOfficeHours ? { hoursAvailable: settings.publicOfficeHours } : {})
      }
    } : {})
  };
}
