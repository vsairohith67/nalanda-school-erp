import { AccountSecurityPanel } from "@/components/account-security-panel";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ passwordChanged?: string }> }) {
  await requireUser();
  const query = await searchParams;
  return <div className="page"><PageHeader title="Account Security" description="Manage verified login identifiers, password safety, and persisted sessions." /><AccountSecurityPanel passwordChanged={query.passwordChanged === "1"} /></div>;
}
