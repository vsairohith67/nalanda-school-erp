import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { roleDisplayLabel } from "@/lib/role-presentation";

export default async function UnauthorizedPage() {
  const user = await requireUser();
  return (
    <main className="page system-state-page">
      <PageHeader
        title="Access Restricted"
        description={`Your ${roleDisplayLabel(user.role)} access does not include that page.`}
      />
      <section className="card card-pad system-state-card" aria-labelledby="access-help-heading">
        <h2 id="access-help-heading">Your account is still secure</h2>
        <p>If you need this workflow, ask the Director or Administrator to complete it.</p>
        <Link className="button" href="/">Return to Dashboard</Link>
      </section>
    </main>
  );
}
