import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("academics");
export default function Page() { return <PublicPage slug="academics" />; }
