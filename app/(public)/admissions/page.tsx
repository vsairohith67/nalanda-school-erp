import { PublicPage, publicPageMetadata } from "../_public-page";
import { AdmissionsPublicEnquiryForm } from "@/components/admissions-public-enquiry-form";
export const generateMetadata = () => publicPageMetadata("admissions");
export default function Page() { return <><PublicPage slug="admissions" /><AdmissionsPublicEnquiryForm /></>; }
