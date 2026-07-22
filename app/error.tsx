"use client";

export default function ErrorPage({
  error: _error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <section className="card card-pad">
        <h2>Something went wrong</h2>
        <p className="notice">
          The requested action could not be completed. Your saved data was not changed by this error screen.
        </p>
        <button onClick={reset}>Try Again</button>
      </section>
    </div>
  );
}
