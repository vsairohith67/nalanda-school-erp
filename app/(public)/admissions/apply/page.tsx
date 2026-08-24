import type { Metadata } from "next";
import { AdmissionApplicationPortal } from "@/components/admission-application-portal";
import { notFound } from "next/navigation";
import { PUBLIC_ADMISSIONS_FORM_FEATURE, isOperationalReleaseFeatureEnabled } from "@/lib/release-feature-flag-runtime";
export const metadata: Metadata = { title: "Invitation-only admission application", robots: { index: false, follow: false, nocache: true } };
export default function Page() { if (!isOperationalReleaseFeatureEnabled(PUBLIC_ADMISSIONS_FORM_FEATURE)) notFound(); return <AdmissionApplicationPortal />; }
