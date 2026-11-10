import Link from "next/link";
import { SearchX } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Adresse inconnue — ou document d'une autre boutique : la RLS le rend
 * introuvable, et c'est bien ce qu'il faut dire, sans préciser qu'il existe.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <Link
        href="/"
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Logo />
      </Link>
      <EmptyState
        icon={SearchX}
        title="Page introuvable"
        description="Cette adresse n'existe pas, ou le document a été supprimé."
        action={
          <Button asChild>
            <Link href="/dashboard">Retour au tableau de bord</Link>
          </Button>
        }
      />
    </main>
  );
}
