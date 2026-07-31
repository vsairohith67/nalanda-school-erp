import type { Metadata } from "next";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { mobileRecoveryConfigured } from "@/lib/auth-delivery";

export const metadata: Metadata = { title: "Forgot Password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ForgotPasswordPage() {
  return <main className="login-page recovery-page"><div className="login-theme"><ThemeToggle /></div>
    <section className="login-panel recovery-panel" aria-labelledby="recovery-heading">
      <div className="login-brand-panel"><div className="login-identity"><Image className="login-logo" src="/nalanda-logo-transparent.png" alt="" width={72} height={72} priority /><div><p className="login-school-name">Nalanda Public School</p><p className="login-system-name">Account recovery</p></div></div><div className="login-platform-copy"><span>Private recovery</span><h1>Reset access without exposing account details</h1><p>Select only the channel type. The portal never reveals a stored address or number.</p></div></div>
      <div className="login-form-panel"><div className="login-copy"><span className="login-kicker">Password help</span><h2 id="recovery-heading">Request a reset</h2><p>You will receive the same response whether or not an eligible account exists.</p></div><ForgotPasswordForm mobileAvailable={mobileRecoveryConfigured()} /></div>
    </section>
  </main>;
}
