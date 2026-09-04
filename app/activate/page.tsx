import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivationFlow } from "@/components/activation-flow";
import { isOperationalReleaseFeatureEnabled, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
export const metadata:Metadata={title:"Secure account activation",referrer:"no-referrer"};
export default function ActivatePage(){if(!isOperationalReleaseFeatureEnabled(REAL_USER_ACCESS_READINESS_FEATURE))notFound();return <main className="activation-shell"><section className="activation-card"><p className="login-kicker">Nalanda School Management System</p><h1>Secure account activation</h1><p>Complete every required security, training and policy step. This link is one-time and must not be shared.</p><ActivationFlow/></section></main>;}
