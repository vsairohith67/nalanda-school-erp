import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("contact");
export default function Page() { return <PublicPage slug="contact" />; }
