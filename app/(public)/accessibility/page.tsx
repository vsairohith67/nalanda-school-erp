import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("accessibility");
export default function Page() { return <PublicPage slug="accessibility" />; }
