"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Erreur inattendue pendant le rendu. Le détail reste dans la console du
 * serveur : l'afficher ici pourrait révéler l'intérieur de l'application.
 * `digest` est l'identifiant que Next associe à l'erreur dans les journaux du
 * serveur — le donner au support permet de la retrouver.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <Logo />
      <EmptyState
        icon={TriangleAlert}
        title="Une erreur est survenue"
        description="Vos données ne sont pas perdues. Réessayez ; si le problème continue, contactez le support."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Réessayer</Button>
            <Button asChild variant="outline">
              <Link href="/support">Contacter le support</Link>
            </Button>
          </div>
        }
      />
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Référence : <span className="tabular">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
