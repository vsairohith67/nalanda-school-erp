import { redirect } from "next/navigation";
export default async function CycleTeacherAnalyticsReportsPage({params}:{params:Promise<{cycleId:string}>}){redirect(`/teacher-analytics/reports?cycleId=${encodeURIComponent((await params).cycleId)}`);}
