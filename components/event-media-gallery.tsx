import Link from "next/link";
import { Images, LockKeyhole, ShieldCheck } from "lucide-react";

type GalleryAlbum = { publicKey: string; title: string; eventDate: string | Date; description: string | null; assets: Array<{ publicKey: string; caption: string | null; width: number | null; height: number | null }> };

export function EventMediaGallery({ albums, audience }: { albums: GalleryAlbum[]; audience: "PUBLIC" | "PARENT_PORTAL" }) {
  const assetBase = audience === "PUBLIC" ? "/api/event-media/public/assets" : "/api/parent/event-media/assets";
  return <main className={`event-gallery ${audience === "PUBLIC" ? "public-event-gallery" : "parent-event-gallery"}`}>
    <header className="event-gallery-header"><div><Images aria-hidden /><div><h1>Event Gallery</h1><p>{audience === "PUBLIC" ? "Only explicitly approved public event photographs appear here." : "Approved event photographs linked to your family."}</p></div></div>{audience === "PUBLIC" ? <Link href="/">Back to school website</Link> : <span><LockKeyhole aria-hidden />Private Parent view</span>}</header>
    <section className="event-gallery-privacy"><ShieldCheck aria-hidden /><div><strong>Privacy-first publication</strong><p>Uploads never appear automatically. Consent revocation or unpublication withdraws access without erasing governance history.</p></div></section>
    {albums.length ? albums.map((album) => <section className="event-gallery-album" key={album.publicKey} id={album.publicKey}><header><div><h2>{album.title}</h2><time dateTime={new Date(album.eventDate).toISOString()}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(album.eventDate))}</time></div>{album.description ? <p>{album.description}</p> : null}</header><div className="event-gallery-grid">{album.assets.map((asset) => <figure key={asset.publicKey}><img src={`${assetBase}/${asset.publicKey}`} alt={asset.caption || `Approved photograph from ${album.title}`} width={asset.width ?? 720} height={asset.height ?? 480} loading="lazy" /><figcaption>{asset.caption || "Approved event photograph"}</figcaption></figure>)}</div></section>) : <section className="event-gallery-empty"><Images aria-hidden /><h2>No approved photographs are available</h2><p>This gallery stays empty until the album, every photograph, and the exact audience are explicitly approved.</p></section>}
  </main>;
}
