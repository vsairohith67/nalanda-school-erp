import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("admissions");
export default function Page() { return <PublicPage slug="admissions" />; }
