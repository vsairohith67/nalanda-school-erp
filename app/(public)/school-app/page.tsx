import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("school-app");
export default function Page() { return <PublicPage slug="school-app" />; }
