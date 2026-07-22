import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("about");
export default function Page() { return <PublicPage slug="about" />; }
