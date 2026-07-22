import { PublicPage, publicPageMetadata } from "../_public-page";
export const generateMetadata = () => publicPageMetadata("student-life");
export default function Page() { return <PublicPage slug="student-life" />; }
