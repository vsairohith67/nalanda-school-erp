import { MarksImporter } from "@/components/marks-importer";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
export default async function Page() { await requirePermission("ENTER_MARKS"); return <div className="page marks-page"><PageHeader title="Preview Marks Import" description="Exact exam, assessment, and admission-number matching. Preview never writes; confirmation is transactional." /><MarksImporter /></div>; }
