import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdmissionsWorkspace } from "@/components/admissions-workspace";
import { getCurrentUserEffectivePermissions, requireUser } from "@/lib/auth";

export default async function Page() {
  await requireUser();
  const permissions = await getCurrentUserEffectivePermissions();
  if (!permissions.has("VIEW_ADMISSIONS") && !permissions.has("REVIEW_ADMISSION_APPLICATIONS")) redirect("/unauthorized");
  return <div className="page admissions-page"><PageHeader title="Admissions and Enquiry CRM" description="Privacy-minimised enquiries, invitation-only applications, governed review, secure documents and exactly-once admission conversion." /><AdmissionsWorkspace /></div>;
}
