import { PageHeader } from "@/components/ui";
import { GateVerificationWorkspace } from "@/components/safe-exit-workspace";
import { requirePermission } from "@/lib/auth";
export default async function Page(){await requirePermission("VERIFY_GATE_PASS");return <div className="page"><PageHeader title="Gate Pass Verification" description="Scan an opaque signed QR or enter the short code. Successful verification never creates consent or approval."/><GateVerificationWorkspace/></div>}
