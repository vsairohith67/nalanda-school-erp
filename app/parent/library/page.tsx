import Link from "next/link";
import { redirect } from "next/navigation";
import { LibraryPortalView } from "@/components/library-portal-view";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getParentLibraryData } from "@/lib/library-portals";
import { prisma } from "@/lib/prisma";

export default async function Page({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const user = await requirePermission("VIEW_OWN_LIBRARY_PORTAL");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const requestedChild = (await searchParams).child;
  let invalidChildSelection = false;
  let data;
  try {
    data = await getParentLibraryData(prisma, user.id, requestedChild);
  } catch (error) {
    if (!requestedChild) throw error;
    invalidChildSelection = true;
    data = await getParentLibraryData(prisma, user.id);
  }
  return <div className="page parent-portal-page">
    <PageHeader title="Parent Library" description="Linked-child-only Library loans, cases, charges, and Library Charge Receipts. Read-only; no online payment or self-service actions." action={<Link className="button secondary" href="/parent">Parent home</Link>} />
    {invalidChildSelection ? <section className="notice">That child is not linked to this Parent account. Showing the first linked child instead.</section> : null}
    {data.children.length > 1 ? <form className="card card-pad parent-child-switcher"><label>Linked child<select name="child" defaultValue={data.selectedChild?.admissionNo}>{data.children.map((child: any) => <option key={child.admissionNo} value={child.admissionNo}>{child.studentName} — {child.className}{child.section ? `-${child.section}` : ""}</option>)}</select></label><button>View Library account</button></form> : null}
    {data.selectedChild ? <section className="notice"><strong>{data.selectedChild.studentName}</strong> — Class {data.selectedChild.className}{data.selectedChild.section ? `-${data.selectedChild.section}` : ""}. Only children linked to this Parent account can be selected.</section> : <section className="notice">No Student is linked to this Parent account.</section>}
    <LibraryPortalView data={data} />
  </div>;
}
