import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("privacy");
export default function Page() { return <PublicPage slug="privacy" />; }
