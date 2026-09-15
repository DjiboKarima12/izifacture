"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { createOrganization } from "@/lib/actions/auth";
import { acceptInvitation } from "@/lib/actions/invitations";
import { codeValide, formaterCode } from "@/lib/invitations";
import { cn } from "@/lib/utils";

export function OnboardingForm() {
  const router = useRouter();

  /**
   * Deux chemins, et c'est le point.
   *
   * Sans ce choix, l'inscription créait TOUJOURS une nouvelle organisation : un
   * caissier invité se retrouvait dans sa propre boutique vide, et sa session
   * retenait celle-là. Rejoindre devait donc exister au même endroit que créer,
   * avant que la première organisation ne soit créée.
   */
  const [mode, setMode] = React.useState<"creer" | "rejoindre">("creer");
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result =
        mode === "rejoindre" ? await acceptInvitation(code) : await createOrganization(name);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card className="mt-6">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold tracking-tight">
              {mode === "creer" ? "Créer votre entreprise" : "Rejoindre une entreprise"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "creer"
                ? "Vos factures, vos clients et votre équipe y seront rattachés. Vous pourrez compléter les coordonnées ensuite dans les paramètres."
                : "Saisissez le code que votre responsable vous a communiqué. Vous rejoindrez sa boutique, avec ses clients et ses produits."}
            </p>

            {/* Le choix est un vrai groupe de boutons radio : les flèches du
                clavier y naviguent, ce qu'une paire de boutons ne permet pas. */}
            <div
              role="radiogroup"
              aria-label="Créer ou rejoindre"
              className="mt-5 inline-flex w-full gap-1 rounded-lg bg-surface p-1"
            >
              {(
                [
                  ["creer", "Créer une entreprise"],
                  ["rejoindre", "J'ai un code"],
                ] as const
              ).map(([valeur, libelle]) => {
                const actif = mode === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => {
                      setMode(valeur);
                      setError(null);
                    }}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      actif
                        ? "bg-background text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {libelle}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "creer" ? (
                <Field label="Nom de l'entreprise" htmlFor="org-name" required>
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="organization"
                    autoFocus
                    required
                  />
                </Field>
              ) : (
                <Field
                  label="Code d'invitation"
                  htmlFor="org-code"
                  hint="Huit lettres ou chiffres, séparés ou non par un tiret."
                  required
                >
                  <Input
                    id="org-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    onBlur={() => setCode((saisi) => formaterCode(saisi))}
                    placeholder="QK4M-8RTP"
                    className="tabular uppercase"
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </Field>
              )}

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  pending ||
                  (mode === "creer" ? name.trim().length < 2 : !codeValide(code))
                }
              >
                {pending
                  ? mode === "creer"
                    ? "Création…"
                    : "Vérification…"
                  : mode === "creer"
                    ? "Continuer"
                    : "Rejoindre"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
