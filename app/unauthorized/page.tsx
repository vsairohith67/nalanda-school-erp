import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function UnauthorizedPage() {
  const user = await requireUser();
  return (
    <div className="page">
      <PageHeader
        title="Access Restricted"
        description={`Your ${user.role} role does not have permission to open that page.`}
      />
      <section className="card card-pad">
        <p>If you need this workflow, ask the Director or Administrator to complete it.</p>
        <Link className="button" href="/">Return to Dashboard</Link>
      </section>
    </div>
  );
}
