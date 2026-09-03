import { StatusBadge } from "@/components/ui/badge";
import {
  statusLabel,
  type RequestActorRole,
  type RequestStatus,
} from "@/lib/requests/types";

/**
 * Request status pill — the raw enum colour from `StatusBadge` (docs/02 §9.1)
 * with the role-scoped wording from api-spec §18.4. `LIVE` reads "Campaign
 * Period" to a Viewer, "Campaign Period" to a Publisher — never the bare enum.
 */
export function RequestStatusPill({
  status,
  role,
  label,
}: {
  status: RequestStatus;
  role: RequestActorRole;
  /** Server-supplied `status_label` wins when present. */
  label?: string;
}) {
  return (
    <StatusBadge status={status} label={label ?? statusLabel(status, role)} />
  );
}
