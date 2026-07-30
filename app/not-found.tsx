import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page system-state-page">
      <section className="card card-pad system-state-card" aria-labelledby="not-found-heading">
        <span className="system-state-code" aria-hidden>404</span>
        <h1 id="not-found-heading">Page not found</h1>
        <p className="notice">
          The requested page does not exist or is no longer available. No data was changed.
        </p>
        <Link className="button" href="/">
          Return to a safe starting page
        </Link>
      </section>
    </main>
  );
}
