import { PageHeader } from "@/components/ui";
import { PaymentForm } from "@/components/payment-form";
import { requirePermission } from "@/lib/auth";

export default async function NewPaymentPage() {
  await requirePermission("CREATE_PAYMENTS");
  return (
    <div className="page">
      <PageHeader title="Add Payment" description="Create one receipt with Cash, UPI, or Bank/Other components. Student details auto-fill by admission number." />
      <PaymentForm />
    </div>
  );
}
