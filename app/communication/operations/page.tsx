import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communicationFeatureAvailability, communicationRoleCapabilities } from "@/lib/communication-policy";
import { loadCommunicationOperations } from "@/lib/communication-service";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function CommunicationOperationsPage() {
  if (!communicationFeatureAvailability().enabled) notFound();
  const user = await requirePermission("VIEW_NOTIFICATION_REPORTS");
  if (!communicationRoleCapabilities(user.role).viewOperations) redirect("/unauthorized");
  const operations = await loadCommunicationOperations(prisma);
  return <div className="page communication-page"><PageHeader title="Communication Delivery Operations" description="Privacy-safe delivery aggregates. Plaintext destinations and message bodies are deliberately excluded." />
    <div className="stats">{Object.entries(operations.states).map(([state, count]) => <div className="card stat" key={state}><span>{state.replaceAll("_", " ")}</span><strong>{String(count)}</strong></div>)}</div>
    <section className="card card-pad"><h2>Provider-neutral channel state</h2><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Channel</th><th>Adapter</th><th>Status</th><th>Circuit</th></tr></thead><tbody>{operations.providerProfiles.map((profile: any) => <tr key={profile.profileCode}><td>{profile.profileCode}</td><td>{profile.channel}</td><td>{profile.adapterKind}</td><td><StatusBadge status={profile.operationalEnabled ? profile.status : "DISABLED"} /></td><td>{profile.circuitState}</td></tr>)}</tbody></table></div><p className="operational-note">No live provider can be activated by this 1A workspace. Dead-letter count: {operations.deadLetters}.</p></section>
  </div>;
}
