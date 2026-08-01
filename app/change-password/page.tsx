import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ChangePasswordPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="page">
      <PageHeader title="Change Password" description="Update your own login password. Use 12 to 128 characters and avoid common passwords." />
      <ChangePasswordForm />
    </div>
  );
}
