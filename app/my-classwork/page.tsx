import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { LearnerClasswork } from "@/components/learner-classwork";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { ClassworkAccessError, resolveClassworkLearnerContext } from "@/lib/classwork-access";
import { loadLearnerClasswork } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function Page({ searchParams }: { searchParams: Promise<{ childContext?: string; contextVersion?: string; history?: string }> }) {
  const user = await requirePermission("VIEW_OWN_CLASSWORK"); if (user.role !== "PARENT" && user.role !== "STUDENT") redirect("/unauthorized");
  const [auth, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]); if (!auth) redirect("/login");
  const contextVersion = query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null;
  const context = await resolveClassworkLearnerContext(prisma, { user: auth.user, sessionId: auth.sessionId, academicYear: settings.academicYear, childHandle: query.childContext, expectedContextVersion: contextVersion }).catch((error) => error instanceof ClassworkAccessError ? null : Promise.reject(error));
  if (!context) return <div className="page classwork-page"><PageHeader title="My Classwork" description="Choose an active linked-child context before accessing private classwork." /><div className="notice danger" role="alert">No eligible learner context is active. Parent users can choose a linked child from the context switcher.</div></div>;
  const data = await loadLearnerClasswork(prisma, context, query.history === "1");
  const contextQuery = context.childHandle ? `childContext=${encodeURIComponent(context.childHandle)}&contextVersion=${context.contextVersion}` : "";
  return <div className="page classwork-page"><PageHeader title="My Classwork" description="Published instructions, private drafts, governed submission versions and Teacher feedback." action={<Link className="button secondary" href={user.role === "PARENT" ? "/parent" : "/"}>Portal home</Link>} /><div className="page-actions"><Link className="button secondary" href={`/my-classwork?${contextQuery}`}>Current</Link><Link className="button secondary" href={`/my-classwork?${contextQuery}${contextQuery ? "&" : ""}history=1`}>History</Link></div><LearnerClasswork data={data as never} /></div>;
}
