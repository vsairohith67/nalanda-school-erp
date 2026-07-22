import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import type { PublicWebsiteBlock } from "@/lib/public-website-blocks";
import { getPublicWebsiteAsset } from "@/lib/public-website-assets";
import type { PublicNavigationLink } from "@/components/public-mobile-navigation";
import { PublicMobileNavigation } from "@/components/public-mobile-navigation";

type Settings = {
  siteName: string; shortName: string; tagline: string | null; publicAddress: string | null;
  publicOfficePhone: string | null; publicOfficeEmail: string | null; publicOfficeHours: string | null;
  publicDirectionsUrl: string | null; portalLoginPath: string;
};
type Post = { postType: string; title: string; slug: string; summary: string; publishAt: Date | null; publishedAt: Date | null };

const fallbackLinks: PublicNavigationLink[] = [
  { itemCode: "ABOUT", label: "About", href: "/about", opensNewTab: false, placement: "BOTH" },
  { itemCode: "ACADEMICS", label: "Academics", href: "/academics", opensNewTab: false, placement: "BOTH" },
  { itemCode: "ADMISSIONS", label: "Admissions", href: "/admissions", opensNewTab: false, placement: "BOTH" },
  { itemCode: "FACILITIES", label: "Facilities", href: "/facilities", opensNewTab: false, placement: "BOTH" },
  { itemCode: "STUDENT_LIFE", label: "Student life", href: "/student-life", opensNewTab: false, placement: "BOTH" },
  { itemCode: "NEWS", label: "News", href: "/news", opensNewTab: false, placement: "BOTH" },
  { itemCode: "CONTACT", label: "Contact", href: "/contact", opensNewTab: false, placement: "BOTH" }
];

export function PublicHeader({ settings, navigation }: { settings: Settings; navigation: PublicNavigationLink[] }) {
  const links = navigation.filter((item) => item.placement === "HEADER" || item.placement === "BOTH");
  const effective = links.length ? links : fallbackLinks;
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link className="public-brand" href="/" aria-label={`${settings.siteName} public website home`}>
          <Image src="/nalanda-logo.jpg" width={56} height={56} alt="" priority />
          <span><strong>{settings.siteName}</strong><small>{settings.tagline || "Learning with purpose"}</small></span>
        </Link>
        <nav className="public-desktop-nav" aria-label="Public navigation">
          {effective.map((link) => <Link key={link.itemCode} href={link.href} target={link.opensNewTab ? "_blank" : undefined} rel={link.opensNewTab ? "noopener noreferrer" : undefined}>{link.label}</Link>)}
        </nav>
        <Link className="public-login-button" href="/login"><LockKeyhole size={17} aria-hidden />School Portal Login</Link>
        <PublicMobileNavigation links={effective} />
      </div>
    </header>
  );
}

export function PublicFooter({ settings, navigation }: { settings: Settings; navigation: PublicNavigationLink[] }) {
  const links = navigation.filter((item) => item.placement === "FOOTER" || item.placement === "BOTH");
  return (
    <footer className="public-footer">
      <div className="public-footer-grid">
        <div><Image src="/nalanda-logo.jpg" width={68} height={68} alt="" /><h2>{settings.siteName}</h2><p>{settings.tagline || "Public information is reviewed before publication."}</p></div>
        <nav aria-label="Footer navigation">{(links.length ? links : fallbackLinks).map((link) => <Link key={link.itemCode} href={link.href} target={link.opensNewTab ? "_blank" : undefined} rel={link.opensNewTab ? "noopener noreferrer" : undefined}>{link.label}</Link>)}</nav>
        <div><h2>Public information</h2><Link href="/privacy">Privacy</Link><Link href="/accessibility">Accessibility</Link><Link href="/terms">Terms</Link><Link href="/school-app">School app experience</Link></div>
        <div><h2>Secure access</h2><p>Student, Parent, Teacher and leadership records remain inside the authenticated ERP.</p><Link className="public-footer-login" href="/login">Open School Portal <ArrowRight aria-hidden size={16} /></Link></div>
      </div>
      <div className="public-footer-base"><span>© {new Date().getFullYear()} {settings.siteName}</span><span>No visitor tracking by default</span></div>
    </footer>
  );
}

function RichText({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim());
  return <div className="public-rich-text">{lines.map((line, index) => {
    const value = line.trim();
    if (value.startsWith("### ")) return <h3 key={index}>{value.slice(4)}</h3>;
    if (value.startsWith("## ")) return <h2 key={index}>{value.slice(3)}</h2>;
    if (/^[-*]\s+/.test(value)) return <p className="public-list-line" key={index}><Check size={17} aria-hidden />{value.replace(/^[-*]\s+/, "")}</p>;
    return <p key={index}>{value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}</p>;
  })}</div>;
}

export function PublicBlocks({ blocks, settings, posts = [] }: { blocks: PublicWebsiteBlock[]; settings: Settings; posts?: Post[] }) {
  return <>{blocks.map((block, index) => {
    if (block.type === "HERO") return <section className="public-hero" key={index}><div className="public-hero-orb one" /><div className="public-hero-orb two" /><div className="public-hero-copy"><span className="public-eyebrow"><Sparkles size={16} aria-hidden />{String(block.eyebrow || "Nalanda Public School")}</span><h1>{String(block.heading)}</h1><p>{String(block.body)}</p><div className="public-hero-actions">{block.primaryLabel && block.primaryHref ? <Link className="public-primary-button" href={String(block.primaryHref)}>{String(block.primaryLabel)}<ArrowRight size={17} aria-hidden /></Link> : null}<Link className="public-secondary-button" href="/about">Explore the school</Link></div><div className="public-trust-line"><ShieldCheck size={18} aria-hidden /><span>Public information only. School records stay behind secure login.</span></div></div><div className="public-hero-mark"><Image src="/nalanda-logo.jpg" width={360} height={360} alt="" priority /><span>Learning · Character · Community</span></div></section>;
    if (block.type === "RICH_TEXT") return <section className="public-section" key={index}><RichText markdown={String(block.markdown)} /></section>;
    if (block.type === "FEATURE_GRID" || block.type === "FACT_GRID" || block.type === "TIMELINE") return <section className="public-section" key={index}><div className="public-section-heading"><span>Explore</span><h2>{String(block.heading)}</h2></div><div className="public-feature-grid">{(block.items as string[]).map((item, itemIndex) => <article key={item}><span className="public-card-number">{String(itemIndex + 1).padStart(2, "0")}</span><h3>{item}</h3><p>Leadership-reviewed details will appear here when approved for public release.</p></article>)}</div></section>;
    if (block.type === "CTA") return <section className="public-section" key={index}><div className="public-cta"><div><span>Next step</span><h2>{String(block.heading)}</h2><p>{String(block.body || "")}</p></div><Link className="public-primary-button" href={String(block.href)}>{String(block.label)}<ArrowRight size={17} aria-hidden /></Link></div></section>;
    if (block.type === "FAQ") return <section className="public-section" key={index}><div className="public-section-heading"><span>Questions</span><h2>{String(block.heading)}</h2></div><div className="public-faq">{(block.items as Array<{question:string;answer:string}>).map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
    if (block.type === "REGISTERED_IMAGE") {
      const asset = getPublicWebsiteAsset(String(block.assetKey));
      return <figure className="public-registered-image" key={index}><Image src={asset.src} width={asset.width} height={asset.height} alt={String(block.alt)} /><figcaption>{String(block.caption || "")}</figcaption></figure>;
    }
    if (block.type === "QUOTE_WITHOUT_PERSONAL_ATTRIBUTION") return <blockquote className="public-quote" key={index}>{String(block.quote)}</blockquote>;
    if (block.type === "CONTACT_DETAILS") return <PublicContactDetails settings={settings} key={index} />;
    if (block.type === "PORTAL_LOGIN") return <section className="public-section" key={index}><div className="public-portal-card"><LockKeyhole size={32} aria-hidden /><div><h2>{String(block.heading)}</h2><p>{String(block.body || "Sign in to reach authorised school services. Public pages never expose ERP records.")}</p></div><Link className="public-primary-button" href="/login">School Portal Login<ArrowRight size={17} aria-hidden /></Link></div></section>;
    return <PublicNewsGrid heading={String(block.heading)} posts={posts.slice(0, Number(block.limit || 3))} key={index} />;
  })}</>;
}

export function PublicContactDetails({ settings }: { settings: Settings }) {
  const rows = [
    settings.publicAddress ? { icon: MapPin, label: "Address", value: settings.publicAddress } : null,
    settings.publicOfficePhone ? { icon: Phone, label: "Office phone", value: settings.publicOfficePhone } : null,
    settings.publicOfficeEmail ? { icon: Mail, label: "Office email", value: settings.publicOfficeEmail } : null
  ].filter(Boolean) as Array<{ icon: typeof MapPin; label: string; value: string }>;
  return <section className="public-section"><div className="public-section-heading"><span>Contact</span><h2>Verified public contact details</h2><p>This page intentionally has no enquiry form, upload or prospect database.</p></div>{rows.length ? <div className="public-contact-grid">{rows.map((row) => { const Icon = row.icon; return <article key={row.label}><Icon aria-hidden /><span>{row.label}</span><strong>{row.value}</strong></article>; })}{settings.publicOfficeHours ? <article><span>Office hours</span><strong>{settings.publicOfficeHours}</strong></article> : null}</div> : <div className="public-awaiting"><h3>Content awaiting school approval</h3><p>Verified address, office phone, email and office hours have not yet been published.</p></div>}{settings.publicDirectionsUrl ? <a className="public-secondary-button" href={settings.publicDirectionsUrl} target="_blank" rel="noopener noreferrer">Approved directions <ExternalLink size={16} aria-hidden /></a> : null}</section>;
}

export function PublicNewsGrid({ posts, heading = "Latest school news", headingLevel = "h2" }: { posts: Post[]; heading?: string; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return <section className="public-section"><div className="public-section-heading"><span>Newsroom</span><Heading>{heading}</Heading></div>{posts.length ? <div className="public-news-grid">{posts.map((post) => <article key={post.slug}><span>{post.postType.replaceAll("_", " ")}</span><h3><Link href={`/news/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p><Link href={`/news/${post.slug}`}>Read public update <ArrowRight size={16} aria-hidden /></Link></article>)}</div> : <div className="public-awaiting"><h3>No published public updates yet</h3><p>Leadership-reviewed news and announcements will appear here.</p></div>}</section>;
}
