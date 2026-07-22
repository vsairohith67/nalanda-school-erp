import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { defaultPathForRole } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { isFirstRunRequired } from "@/lib/setup";

export default async function LoginPage() {
  if (await isFirstRunRequired(prisma)) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(defaultPathForRole(user.role));
  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-panel">
        <div className="login-brand">
          <Image src="/nalanda-logo.jpg" alt="Nalanda Public School" width={82} height={82} priority />
          <div>
            <strong>NALANDA</strong>
            <span>PUBLIC SCHOOL</span>
          </div>
        </div>
        <div className="login-copy">
          <h1>Nalanda Fee Control 2026-27</h1>
          <p>Private school management access</p>
        </div>
        <Suspense fallback={<div className="login-form">Loading login...</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
