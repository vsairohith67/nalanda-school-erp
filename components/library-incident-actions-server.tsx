import { IncidentActions as ClientIncidentActions } from "@/components/library-accountability-forms";

type CopyOptionSource = { id: string; accessionNumber: string; title: { title: string } };

export function IncidentActions(props: {
  id: string;
  status: string;
  canApprove: boolean;
  canManage: boolean;
  copies: CopyOptionSource[];
}) {
  const copies = props.copies.map((copy) => ({
    id: copy.id,
    accessionNumber: copy.accessionNumber,
    title: { title: copy.title.title }
  }));
  return <ClientIncidentActions {...props} copies={copies} />;
}
