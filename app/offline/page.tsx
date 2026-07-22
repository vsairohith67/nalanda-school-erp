import Link from "next/link";
import { OfflinePageStatus } from "@/components/offline-page-status";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-heading">
        <p className="offline-eyebrow">Nalanda Public School ERP</p>
        <h1 id="offline-heading">You are offline.</h1>
        <p>Reconnect to continue securely.</p>
        <p><strong>School records are not stored for offline use.</strong></p>
        <OfflinePageStatus />
        <div className="page-actions">
          <a className="button" href="/offline">Retry Connection</a>
          <Link className="button secondary" href="/login">Return to Login</Link>
        </div>
        <noscript><p>Reconnect, then reload this page or return to the login page.</p></noscript>
      </section>
    </main>
  );
}

