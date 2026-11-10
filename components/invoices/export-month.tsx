import { FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayIso } from "@/lib/dates";

/**
 * Export du mois choisi pour le comptable. Un simple formulaire GET : le
 * navigateur télécharge le fichier, sans JavaScript et sans quitter la page.
 */
export function ExportMonth({ kind }: { kind: "factures" | "encaissements" }) {
  return (
    <form action={`/export/${kind}`} method="get" className="flex items-center gap-2">
      <label htmlFor={`export-${kind}`} className="sr-only">
        Mois à exporter
      </label>
      <Input
        id={`export-${kind}`}
        type="month"
        name="mois"
        defaultValue={todayIso().slice(0, 7)}
        className="h-9 w-[184px]"
      />
      <Button type="submit" variant="outline" size="sm">
        <FileSpreadsheet aria-hidden />
        Exporter
      </Button>
    </form>
  );
}
