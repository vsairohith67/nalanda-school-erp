import { NoticeManager, type NoticeView } from "@/components/notice-manager";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { CLASS_NAMES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function NoticesPage() {
  const user = await requirePermission("VIEW_NOTICES");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const [notices, studentSections] = await Promise.all([
    prisma.notice.findMany({
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } }
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.student.findMany({
      where: { deletedAt: null, section: { not: null } },
      select: { section: true }
    })
  ]);
  const sections = [...new Set([
    "A", "B", "C", "D",
    ...studentSections.map((row) => row.section?.trim().toUpperCase()).filter((value): value is string => Boolean(value))
  ])].sort();

  return (
    <div className="page notices-page">
      <PageHeader
        title="Parent Notices"
        description="Prepare simple school announcements and publish them safely to the parent portal. Draft and archived notices are never shown to parents."
      />
      <NoticeManager
        initialNotices={notices.map(toNoticeView)}
        classOptions={[...CLASS_NAMES]}
        sectionOptions={sections}
        canManage={permissionSetCan(permissions, "MANAGE_NOTICES")}
        canPublish={permissionSetCan(permissions, "PUBLISH_NOTICES")}
      />
    </div>
  );
}

function toNoticeView(notice: {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  className: string | null;
  section: string | null;
  status: string;
  publishDate: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
}): NoticeView {
  return {
    ...notice,
    publishDate: notice.publishDate?.toISOString() ?? null,
    expiresAt: notice.expiresAt?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
    createdBy: notice.createdBy,
    updatedBy: notice.updatedBy
  };
}
