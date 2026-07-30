"use client";

export default function ErrorPage({
  error: _error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page system-state-page">
      <section className="card card-pad system-state-card" aria-labelledby="error-heading">
        <span className="system-state-code" aria-hidden>!</span>
        <h1 id="error-heading">Something went wrong</h1>
        <p className="notice">
          The requested action could not be completed. Your saved data was not changed by this error screen.
        </p>
        <button type="button" onClick={reset}>Try Again</button>
      </section>
    </main>
  );
}
