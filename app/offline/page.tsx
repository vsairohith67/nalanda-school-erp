import Link from "next/link";
import { OfflinePageStatus } from "@/components/offline-page-status";
import { PRODUCT_BRAND } from "@/config/product-brand";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-heading">
        <p className="offline-eyebrow">{PRODUCT_BRAND.productName}</p>
        <h1 id="offline-heading">You are offline.</h1>
        <p>Reconnect to continue securely.</p>
        <p><strong>General school records are not stored for offline use.</strong> A previously approved Accountant may use the separate encrypted finance-draft workspace on a trusted device.</p>
        <OfflinePageStatus />
        <div className="page-actions">
          <a className="button" href="/offline">Retry Connection</a>
          <Link className="button secondary" href="/offline/finance">Open Encrypted Drafts</Link>
          <Link className="button secondary" href="/login">Return to Login</Link>
        </div>
        <noscript><p>Reconnect, then reload this page or return to the login page.</p></noscript>
      </section>
    </main>
  );
}
