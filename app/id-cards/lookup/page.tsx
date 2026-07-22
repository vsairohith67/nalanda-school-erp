import { PageHeader } from "@/components/ui";
import { IdentityCardLookupForm } from "@/components/identity-card-forms";
import { requirePermission } from "@/lib/auth";

export default async function IdentityCardLookupPage() {
  await requirePermission("USE_ID_CARD_LOOKUP");
  return <div className="page identity-card-page"><PageHeader title="Internal ID Card Lookup" description="Authenticated exact card-number or Code 39 value lookup. No fuzzy matching and no public endpoint."/><IdentityCardLookupForm/></div>;
}
