import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ActiveContextSwitcher } from "@/components/iam/active-context-switcher";
import { roleDisplayLabel } from "@/lib/role-presentation";

export default async function AccessContextPage() {
  const user = await requireUser();
  return <div className="page iam-page"><PageHeader title="Active Access Context" description="Role context and linked-child context are separate, server-stored and revalidated on every request." /><section className="card"><dl className="detail-grid"><div><dt>Named user</dt><dd>{user.name}</dd></div><div><dt>Human designation</dt><dd>{user.designation ?? "Not set"}</dd></div><div><dt>Active role context</dt><dd>{roleDisplayLabel(user.role)}</dd></div><div><dt>Authorization version</dt><dd>{user.authorizationVersion}</dd></div></dl><ActiveContextSwitcher activeRole={user.role} /><div className="notice"><strong>Scope remains mandatory.</strong><span>Changing context never bypasses Teacher timetable or examination scope, Parent linked-child scope, financial record scope, academic-year/class/section scope or private-object ownership.</span></div></section></div>;
}
