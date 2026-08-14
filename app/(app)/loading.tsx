import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";

/**
 * Squelette affiché pendant le rendu serveur des pages de l'application.
 *
 * Sans ce fichier, l'App Router n'a aucune frontière Suspense sur ce groupe de
 * routes : au clic sur un lien, le navigateur reste sur la page précédente
 * jusqu'à ce que TOUT le rendu serveur soit terminé — session, requêtes, HTML.
 * Rien ne bouge à l'écran, puis la page apparaît d'un bloc. Avec la frontière,
 * Next bascule immédiatement et diffuse le contenu au fur et à mesure.
 *
 * Un seul squelette pour tout le groupe : il reprend la silhouette commune à ces
 * pages — un titre, une rangée de cartes, un tableau. Il ne cherche pas à
 * imiter chaque page au pixel près, seulement à occuper la place pour que la
 * mise en page ne saute pas quand le contenu arrive.
 *
 * `animate-pulse` est la seule animation en boucle admise par le design system,
 * au titre d'indicateur de chargement, et `prefers-reduced-motion` la neutralise
 * globalement depuis `globals.css`.
 */
function Bar({ className }: { className?: string }) {
  return <div className={`rounded-md bg-muted ${className ?? ""}`} />;
}

export default function AppLoading() {
  return (
    <PageShell className="max-w-[1240px] pt-0" aria-busy>
      <span className="sr-only">Chargement en cours…</span>

      <div className="animate-pulse">
        <Bar className="h-6 w-48" />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <Bar className="h-4 w-28" />
                <Bar className="size-8 shrink-0" />
              </div>
              <Bar className="mt-4 h-7 w-36" />
              <Bar className="mt-3 h-3 w-24" />
            </Card>
          ))}
        </div>

        <Card className="mt-5">
          <div className="flex items-start justify-between gap-4 p-6">
            <div className="space-y-2">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-64" />
            </div>
            <Bar className="h-8 w-24" />
          </div>

          <div className="border-t border-border">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-b-0"
              >
                <div className="flex-1 space-y-2">
                  <Bar className="h-4 w-40" />
                  <Bar className="h-3 w-56" />
                </div>
                <Bar className="h-4 w-24 shrink-0" />
                <Bar className="h-5 w-20 shrink-0" />
                <Bar className="h-4 w-28 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
