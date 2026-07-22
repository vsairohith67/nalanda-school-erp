import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("mandatory-disclosure");
export default function Page() { return <PublicPage slug="mandatory-disclosure" mandatory />; }
