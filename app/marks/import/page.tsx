import { redirect } from "next/navigation";
import { MarksImporter } from "@/components/marks-importer";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { resolveMarksWriteAuthority } from "@/lib/academic-integrity";
import { resolveMarksScope } from "@/lib/marks-scope";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const user = await requirePermission("ENTER_MARKS");
  await resolveMarksWriteAuthority(prisma, user);
  const scope = await resolveMarksScope(prisma, user, undefined, "WRITE");
  if (!scope.broad && !scope.targets.length) redirect("/unauthorized");
  return <div className="page marks-page"><PageHeader title="Preview Marks Import" description="Principal-controlled import. Every row must match an exact active delegated scope before confirmation." /><MarksImporter /></div>;
}
