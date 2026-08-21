import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createContact, createDiaryEntry, createTask, listSuperAdminWork, updateContact, updateDiaryEntry, updateTask } from "@/lib/super-admin-work";
import { parseSuperAdminWorkBody, superAdminWorkError, superAdminWorkJson } from "@/lib/super-admin-work-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    return superAdminWorkJson(await listSuperAdminWork(prisma, auth.user));
  } catch (error) {
    return superAdminWorkError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await parseSuperAdminWorkBody(request);
    const entity = String(body.entity ?? "").toUpperCase();
    const record = entity === "DIARY"
      ? await createDiaryEntry(prisma, auth.user, body.data)
      : entity === "TASK"
        ? await createTask(prisma, auth.user, body.data)
        : entity === "CONTACT"
          ? await createContact(prisma, auth.user, body.data)
          : null;
    if (!record) return superAdminWorkJson({ error: "Choose Diary, Task or Contact.", code: "WORK_ENTITY_INVALID" }, 400);
    return superAdminWorkJson({ record }, 201);
  } catch (error) {
    return superAdminWorkError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await parseSuperAdminWorkBody(request);
    const entity = String(body.entity ?? "").toUpperCase();
    const record = entity === "DIARY"
      ? await updateDiaryEntry(prisma, auth.user, body.publicKey, body.data)
      : entity === "TASK"
        ? await updateTask(prisma, auth.user, body.publicKey, body.data)
        : entity === "CONTACT"
          ? await updateContact(prisma, auth.user, body.publicKey, body.data)
          : null;
    if (!record) return superAdminWorkJson({ error: "Choose Diary, Task or Contact.", code: "WORK_ENTITY_INVALID" }, 400);
    return superAdminWorkJson({ record });
  } catch (error) {
    return superAdminWorkError(error);
  }
}
