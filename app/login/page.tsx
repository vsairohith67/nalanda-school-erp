import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { defaultPathForRole } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { isFirstRunRequired } from "@/lib/setup";
import { PRODUCT_BRAND } from "@/config/product-brand";

export default async function LoginPage() {
  if (await isFirstRunRequired(prisma)) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(defaultPathForRole(user.role));
  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-brand-panel">
          <div className="login-identity">
            <Image className="login-logo" src={PRODUCT_BRAND.logoPath} alt="" width={72} height={72} priority />
            <div>
              <p className="login-school-name full-school-name">{PRODUCT_BRAND.schoolName}</p>
              <p className="login-system-name">{PRODUCT_BRAND.productName}</p>
            </div>
          </div>
          <div className="login-platform-copy">
            <span>Secure school portal</span>
            <h1>{PRODUCT_BRAND.productName}</h1>
            <p>{PRODUCT_BRAND.technicalDescriptor}. One protected workspace for authorised school operations, communication, learning, and administration.</p>
          </div>
          <p className="login-security-note">Private access for authorised users only.</p>
        </div>
        <div className="login-form-panel">
          <div className="login-copy">
            <span className="login-kicker">Welcome back</span>
            <h2 id="login-heading">Sign in to {PRODUCT_BRAND.nativeShortName}</h2>
            <p>Use your school-issued username or a verified login identifier and password.</p>
          </div>
          <Suspense fallback={<div className="login-form" role="status">Loading secure sign-in…</div>}>
            <LoginForm />
          </Suspense>
          <nav className="login-links" aria-label="Login support links">
            <Link href="/forgot-password">Forgot Password</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Use</Link>
            <Link href="/contact">Contact Support</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
