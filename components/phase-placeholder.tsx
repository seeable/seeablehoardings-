import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Placeholder for a screen whose full build lands in a later phase. Keeps the
 * nav shells free of dead links now that they're wired up (Phase 4).
 */
export function PhasePlaceholder({
  title,
  screen,
  phase,
  note,
}: {
  title: string;
  screen: string;
  phase: number;
  note?: string;
}) {
  return (
    <section>
      <h1 className="text-h1 text-ink-900">{title}</h1>
      <div className="mt-6">
        <EmptyState
          icon={Construction}
          headline={`${screen} arrives in Phase ${phase}`}
          body={
            note ??
            "The navigation, layout, and data plumbing are in place — this screen's UI is built in a later phase."
          }
        />
      </div>
    </section>
  );
}
