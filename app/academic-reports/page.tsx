import { AcademicReportingPage } from "@/components/academic-reporting-page";
export default function Page() { return <AcademicReportingPage allowedRoles={["SUPER_ADMIN","DIRECTOR","PRINCIPAL","VIEWER"]}/>; }
