import { PublicPage, publicPageMetadata } from "../_public-page";
import { AdmissionsPublicEnquiryForm } from "@/components/admissions-public-enquiry-form";
import { PUBLIC_ADMISSIONS_FORM_FEATURE, isOperationalReleaseFeatureEnabled } from "@/lib/release-feature-flag-runtime";
export const generateMetadata = () => publicPageMetadata("admissions");
export default function Page() { const enabled = isOperationalReleaseFeatureEnabled(PUBLIC_ADMISSIONS_FORM_FEATURE); return <><PublicPage slug="admissions" />{enabled ? <AdmissionsPublicEnquiryForm /> : <section className="public-section" aria-labelledby="admissions-enquiry-unavailable"><div className="public-section-heading"><span>Admissions enquiry</span><h2 id="admissions-enquiry-unavailable">Online submissions are not currently available</h2><p>Please use the school&apos;s published contact details. No enquiry or application data can be submitted through this page.</p></div></section>}</>; }
