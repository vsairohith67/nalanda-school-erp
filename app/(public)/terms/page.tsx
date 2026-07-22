import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("terms");
export default function Page() { return <PublicPage slug="terms" />; }
