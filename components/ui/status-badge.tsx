import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/status";
import type { DisplayStatus, DocumentType } from "@/lib/domain/types";

/**
 * Pastille de statut. Le libellé est toujours écrit : la couleur ne porte jamais
 * l'information à elle seule, ce qui la garde lisible en cas de daltonisme comme
 * à l'impression en noir et blanc.
 */
const STATUS_CLASSES: Record<DisplayStatus, string> = {
  draft: "bg-status-draft-bg text-status-draft",
  sent: "bg-status-sent-bg text-status-sent",
  partially_paid: "bg-status-partial-bg text-status-partial",
  paid: "bg-status-paid-bg text-status-paid",
  overdue: "bg-status-overdue-bg text-status-overdue",
  // Un devis expiré n'est pas une alerte : il est simplement caduc.
  expired: "bg-status-cancelled-bg text-status-cancelled",
  cancelled: "bg-status-cancelled-bg text-status-cancelled",
};

export function StatusBadge({
  status,
  type = "invoice",
  className,
}: {
  status: DisplayStatus;
  type?: DocumentType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {statusLabel(status, type)}
    </span>
  );
}
