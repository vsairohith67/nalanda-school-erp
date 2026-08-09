import { PublicPage, publicPageMetadata } from "../_public-page";
import { PublicSupportForm } from "@/components/public-support-form";
export const generateMetadata = () => publicPageMetadata("contact");
export default function Page() { return <><PublicPage slug="contact" /><PublicSupportForm /></>; }
