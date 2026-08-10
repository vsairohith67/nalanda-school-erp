export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <section className="card card-pad" role="status" aria-live="polite">
        <p className="eyebrow">Governed maintenance window</p>
        <h1 id="maintenance-title">NALANDA PUBLIC SCHOOL</h1>
        <h2>ERP maintenance in progress</h2>
        <p>School records are protected while a controlled release or recovery check is completed. Please save any offline notes and retry shortly.</p>
        <p>No technical details or private records are shown on this page.</p>
        <a className="button" href="/login">Retry securely</a>
      </section>
    </main>
  );
}
