import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBlocks } from "@/components/public-website";
import { prisma } from "@/lib/prisma";
import { defaultPublicBlocks, defaultPublicSeo, getPublishedPublicPage, getPublishedPublicSettings, listActivePublicPosts } from "@/lib/public-website-content";
import { buildPublicMetadata } from "@/lib/public-website-seo";

const titles: Record<string, string> = {
  "": "A thoughtful place to learn and grow",
  about: "About Nalanda", academics: "Learning at Nalanda", admissions: "Admissions guidance",
  facilities: "Spaces for learning", "student-life": "Student life", contact: "Contact the school office",
  "school-app": "School app experience", privacy: "Public website privacy", accessibility: "Accessibility statement",
  terms: "Public website terms", "mandatory-disclosure": "Mandatory disclosure"
};

const specialFallbacks: Record<string, Array<Record<string, unknown>>> = {
  admissions: [
    { type: "HERO", eyebrow: "Admissions", heading: "A clear, human admissions starting point", body: "Reviewed admissions details will be published here. Contact the school office using verified public details when available.", primaryLabel: "Contact the office", primaryHref: "/contact" },
    { type: "FEATURE_GRID", heading: "What this page will explain", items: ["Entry-stage guidance", "Reviewed document categories", "Approved admissions steps"] },
    { type: "RICH_TEXT", markdown: "## Safe admissions boundary\n\nThere is no public enquiry form, application upload, admission payment or prospect database in this foundation." }
  ],
  "school-app": [
    { type: "HERO", eyebrow: "School app experience", heading: "Secure school access, designed for the device you already use", body: "The existing installable web app supports secure Parent, Teacher and leadership journeys after login.", primaryLabel: "School Portal Login", primaryHref: "/login" },
    { type: "FEATURE_GRID", heading: "Key journeys", items: ["Parent portal: linked-child information after login", "Teacher portal: authorised daily workflows after login", "Leadership ERP: role-gated operational control"] },
    { type: "RICH_TEXT", markdown: "## Current app boundary\n\nLogin remains required. School records are not stored for offline use. Parent access stays limited to server-authorised linked-child records, and Teacher access stays limited to assigned role permissions. There is no government-ID function, native app, app-store certification or push notification service.\n\n## Installation readiness\n\nAndroid and iPhone installation require production HTTPS and physical-device testing. The current PWA is the preferred first step; a wrapper or native app should be considered only when verified device capabilities justify it." },
    { type: "PORTAL_LOGIN", heading: "Use the secure school portal", body: "Public pages and authenticated ERP data remain strictly separated." }
  ],
  privacy: [
    { type: "HERO", eyebrow: "Privacy", heading: "A public website without visitor tracking by default", body: "This foundation does not add analytics pixels, advertising, enquiry databases, uploads or public AI access.", primaryLabel: "Accessibility", primaryHref: "/accessibility" },
    { type: "RICH_TEXT", markdown: "## Public and private separation\n\nPublic pages use only approved public content and registered local assets. Student, Parent, Guardian, Staff, fee, attendance, marks and communication records remain inside authenticated routes.\n\n## Cookies\n\nThe public website does not create a session or set unnecessary cookies. The secure portal uses authentication only after a visitor chooses to sign in." }
  ],
  accessibility: [
    { type: "HERO", eyebrow: "Accessibility", heading: "Designed toward WCAG 2.2 AA", body: "The public experience targets keyboard access, visible focus, semantic landmarks, reduced motion, meaningful links and responsive use from 320 pixels upward.", primaryLabel: "Contact", primaryHref: "/contact" },
    { type: "FEATURE_GRID", heading: "Accessibility foundations", items: ["Skip link and semantic landmarks", "Keyboard-operable navigation", "Visible focus and reduced motion", "Controlled headings and image alt text"] }
  ],
  terms: [
    { type: "HERO", eyebrow: "Terms", heading: "Public information with a controlled publication history", body: "Published corrections create new immutable versions; earlier public versions remain preserved for accountability.", primaryLabel: "Privacy", primaryHref: "/privacy" },
    { type: "RICH_TEXT", markdown: "## Information status\n\nSchool information remains subject to leadership review and correction. Content marked as awaiting approval is intentionally not a factual claim.\n\n## Secure services\n\nPortal use is governed by authentication, permissions and the existing ERP security controls." }
  ],
  contact: [
    { type: "HERO", eyebrow: "Contact", heading: "Reach the school through verified public details", body: "Only leadership-approved office contact information is displayed.", primaryLabel: "Admissions guidance", primaryHref: "/admissions" },
    { type: "CONTACT_DETAILS", heading: "Verified public contact details" }
  ]
};

export async function publicPageMetadata(slug: string): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPublishedPublicPage(prisma, slug), getPublishedPublicSettings(prisma)]);
  const seo = page?.seo ?? defaultPublicSeo(titles[slug] || "Nalanda Public School", slug);
  return buildPublicMetadata(seo, settings.publicSiteUrl);
}

export async function PublicPage({ slug, mandatory = false }: { slug: string; mandatory?: boolean }) {
  const [page, settings, posts] = await Promise.all([getPublishedPublicPage(prisma, slug), getPublishedPublicSettings(prisma), listActivePublicPosts(prisma, new Date(), 6)]);
  if (mandatory && (!settings.mandatoryDisclosureEnabled || !page)) notFound();
  const title = titles[slug] || "Nalanda Public School";
  const blocks = page?.blocks ?? (specialFallbacks[slug] || defaultPublicBlocks(title));
  return <PublicBlocks blocks={blocks as never} settings={settings} posts={posts} />;
}
