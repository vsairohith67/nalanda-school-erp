import type { Metadata } from "next";
import { AdmissionApplicationPortal } from "@/components/admission-application-portal";
export const metadata: Metadata = { title: "Invitation-only admission application", robots: { index: false, follow: false, nocache: true } };
export default function Page() { return <AdmissionApplicationPortal />; }
