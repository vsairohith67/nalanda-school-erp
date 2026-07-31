import type { Metadata } from "next";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Reset Password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage() {
  return <main className="login-page recovery-page"><div className="login-theme"><ThemeToggle /></div>
    <section className="login-panel recovery-panel" aria-labelledby="reset-heading">
      <div className="login-brand-panel"><div className="login-identity"><Image className="login-logo" src="/nalanda-logo-transparent.png" alt="" width={72} height={72} priority /><div><p className="login-school-name">Nalanda Public School</p><p className="login-system-name">Secure password reset</p></div></div><div className="login-platform-copy"><span>Single-use link</span><h1>Create a new password</h1><p>The reset credential is removed from the address bar and is never sent to logs or analytics.</p></div></div>
      <div className="login-form-panel"><div className="login-copy"><span className="login-kicker">Account security</span><h2 id="reset-heading">Set a new password</h2><p>Successful reset signs out every existing session.</p></div><ResetPasswordForm /></div>
    </section>
  </main>;
}
