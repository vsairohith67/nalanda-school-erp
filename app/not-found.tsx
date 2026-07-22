import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="page">
      <section className="card card-pad">
        <h2>Page not found</h2>
        <p className="notice">
          The requested page does not exist or is no longer available. No data was changed.
        </p>
        <Link className="button" href="/">
          Return to a safe starting page
        </Link>
      </section>
    </div>
  );
}
