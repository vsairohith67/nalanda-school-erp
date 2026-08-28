export default function Loading() {
  return (
    <main className="page system-loading" aria-busy="true" aria-live="polite">
      <span className="system-loading-indicator" aria-hidden />
      <div>
        <h1>Loading your authorised workspace</h1>
        <p>Current data and permissions are being checked.</p>
      </div>
    </main>
  );
}
