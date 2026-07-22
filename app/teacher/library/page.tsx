import Link from "next/link";
import { redirect } from "next/navigation";
import { LibraryPortalView } from "@/components/library-portal-view";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getTeacherLibraryData } from "@/lib/library-portals";
import { prisma } from "@/lib/prisma";
export default async function Page(){const user=await requirePermission("VIEW_OWN_LIBRARY_PORTAL");if(user.role!=="TEACHER")redirect("/unauthorized");const data=await getTeacherLibraryData(prisma,user.id);return <div className="page"><PageHeader title="My Library Account" description="Your own StaffMember-linked Library membership, loans, cases, charges, and receipts. Read-only only." action={<Link className="button secondary" href="/teacher">Teacher home</Link>}/>{data.staff?<section className="notice"><strong>{data.staff.name}</strong>{data.staff.staffCode?` — ${data.staff.staffCode}`:""}. Other staff and Student borrowing records are not accessible.</section>:<section className="notice">No StaffMember is linked to this Teacher login yet.</section>}<LibraryPortalView data={data}/></div>}
