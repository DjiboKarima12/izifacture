"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { createOrganization } from "@/lib/actions/auth";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrganization(name);
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
            <h1 className="text-xl font-bold tracking-tight">Créer votre entreprise</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vos factures, vos clients et votre équipe y seront rattachés. Vous pourrez compléter
              les coordonnées ensuite dans les paramètres.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
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

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending || name.trim().length < 2}>
                {pending ? "Création…" : "Continuer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
