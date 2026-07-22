import Image from "next/image";
import Link from "next/link";
import { SetupForm } from "@/components/setup-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/prisma";
import { isFirstRunRequired } from "@/lib/setup";

export default async function SetupPage() {
  const setupRequired = await isFirstRunRequired(prisma);

  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-panel setup-panel">
        <div className="login-brand">
          <Image src="/nalanda-logo.jpg" alt="Nalanda Public School" width={82} height={82} priority />
          <div>
            <strong>NALANDA</strong>
            <span>FIRST-RUN SETUP</span>
          </div>
        </div>
        {setupRequired ? (
          <>
            <div className="login-copy">
              <h1>Prepare this computer safely</h1>
              <p>Create the first Director account and save the basic school profile.</p>
            </div>
            <SetupForm bootstrapTokenRequired={process.env.NODE_ENV === "production"} />
          </>
        ) : (
          <div className="setup-complete">
            <h1>Setup already completed</h1>
            <p>An active Director account already exists. First-run setup is locked for safety.</p>
            <Link className="button" href="/login">Go to Login</Link>
          </div>
        )}
      </section>
    </main>
  );
}
