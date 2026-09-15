"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createInvitation, revokeInvitation, type Invitation } from "@/lib/actions/invitations";
import { formaterCode } from "@/lib/invitations";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Inviter un caissier dans la boutique.
 *
 * PAR CODE, PAS PAR EMAIL. Aucun service d'envoi n'est configuré, et un lien par
 * email suppose que l'invité relève une adresse. Un code de huit caractères se
 * dicte au téléphone et s'écrit sur un papier — ce qui, au comptoir, marche
 * toujours.
 *
 * Le code est affiché EN GRAND et copiable d'un clic : c'est la seule chose à
 * faire sur cet écran, et il est fait pour être lu à voix haute.
 */

const ROLE_LABELS = { owner: "Propriétaire", admin: "Administrateur", member: "Membre" } as const;

export function InvitePanel({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [copie, setCopie] = React.useState<string | null>(null);

  const enAttente = invitations.filter((invitation) => invitation.acceptedAt === null);

  const inviter = () => {
    setError(null);
    startTransition(async () => {
      const result = await createInvitation("member");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const revoquer = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await revokeInvitation(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const copier = async (code: string) => {
    try {
      await navigator.clipboard.writeText(formaterCode(code));
      setCopie(code);
      window.setTimeout(() => setCopie(null), 2_000);
    } catch {
      // Presse-papiers refusé : le code reste lisible à l'écran, qui est de
      // toute façon la façon dont il sera transmis le plus souvent.
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <h2 className="text-base font-semibold">Inviter un collaborateur</h2>
        <p className="text-sm text-muted-foreground">
          Générez un code, dictez-le à votre caissier. À son inscription, il choisit
          « J&apos;ai un code » et rejoint cette boutique.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pb-6">
        {enAttente.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun code en attente.</p>
        ) : (
          <ul className="space-y-2">
            {enAttente.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="tabular text-lg font-bold tracking-[0.15em]">
                  {formaterCode(invitation.code)}
                </span>

                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {ROLE_LABELS[invitation.role]}
                </span>

                <span className="text-xs text-muted-foreground">
                  Valable jusqu&apos;au {formatDate(invitation.expiresAt.slice(0, 10))}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => copier(invitation.code)}
                  >
                    {copie === invitation.code ? (
                      <Check aria-hidden />
                    ) : (
                      <Copy aria-hidden />
                    )}
                    {copie === invitation.code ? "Copié" : "Copier"}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    aria-label={`Annuler le code ${formaterCode(invitation.code)}`}
                    className={cn("size-9 text-destructive hover:bg-destructive/10")}
                    onClick={() => revoquer(invitation.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Button disabled={pending} onClick={inviter}>
          <UserPlus aria-hidden />
          {pending ? "Génération…" : "Générer un code"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Un code ne sert qu&apos;une fois et expire au bout de sept jours. Il donne le rôle
          « Membre » : accès aux factures, aux clients et aux encaissements, sans les réglages
          de l&apos;entreprise.
        </p>
      </CardContent>
    </Card>
  );
}
