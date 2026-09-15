"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createMemberAccount } from "@/lib/actions/members";
import { identifiantValide, LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/members";

/**
 * Le responsable ouvre lui-même le compte de son caissier.
 *
 * PAS D'EMAIL DEMANDÉ. Un caissier n'a pas toujours d'adresse, et en exiger une
 * pour ouvrir la caisse du matin est un obstacle absurde. On demande un
 * identifiant — « awa » — et on en dérive une adresse de connexion interne.
 *
 * Le mot de passe reste VISIBLE pendant la saisie : le responsable va le dicter
 * à voix haute dans la minute qui suit. Le masquer ne protégerait rien et
 * l'obligerait à le taper deux fois.
 */
export function CreateMemberForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [cree, setCree] = React.useState<{ login: string; password: string } | null>(null);
  const [copie, setCopie] = React.useState(false);

  const [form, setForm] = React.useState({ fullName: "", identifiant: "", password: "" });

  const set = (cle: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((courant) => ({ ...courant, [cle]: event.target.value }));

  const identifiantFaux = form.identifiant.trim() !== "" && !identifiantValide(form.identifiant);
  const complet =
    form.fullName.trim().length >= 2 &&
    identifiantValide(form.identifiant) &&
    form.password.length >= LONGUEUR_MIN_MOT_DE_PASSE;

  const soumettre = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createMemberAccount(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCree({ login: result.data.login, password: form.password });
      setForm({ fullName: "", identifiant: "", password: "" });
      router.refresh();
    });
  };

  const copier = async () => {
    if (!cree) return;
    try {
      await navigator.clipboard.writeText(
        `Identifiant : ${cree.login}\nMot de passe : ${cree.password}`,
      );
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2_000);
    } catch {
      // Presse-papiers refusé : les informations restent lisibles à l'écran.
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <h2 className="text-base font-semibold">Créer un compte</h2>
        <p className="text-sm text-muted-foreground">
          Pour un caissier ou un collaborateur. Pas besoin d&apos;adresse email : vous choisissez
          son identifiant et son mot de passe, et vous les lui donnez.
        </p>
      </CardHeader>

      <CardContent className="pb-6">
        {/*
          Le compte créé est montré UNE FOIS, mot de passe compris. Il n'est
          stocké nulle part en clair : quitter cet écran sans l'avoir noté oblige
          à en définir un nouveau.
        */}
        {cree ? (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Compte créé. Notez ces informations.</p>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="text-muted-foreground">Identifiant</dt>
                <dd className="tabular break-all font-medium">{cree.login}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="text-muted-foreground">Mot de passe</dt>
                <dd className="tabular font-medium">{cree.password}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copier}>
                {copie ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copie ? "Copié" : "Copier"}
              </Button>
              <Button size="sm" onClick={() => setCree(null)}>
                Créer un autre compte
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Le mot de passe n&apos;est plus affiché après cet écran. Il se change depuis
              « Mot de passe oublié » si besoin.
            </p>
          </div>
        ) : (
          <form onSubmit={soumettre} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" htmlFor="membre-nom" required className="sm:col-span-2">
              <Input
                id="membre-nom"
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="Awa Diallo"
                autoComplete="off"
              />
            </Field>

            <Field
              label="Identifiant"
              htmlFor="membre-identifiant"
              hint="Lettres, chiffres, point ou tiret."
              error={identifiantFaux ? "3 à 30 caractères, sans espace ni accent." : undefined}
              required
            >
              <Input
                id="membre-identifiant"
                value={form.identifiant}
                onChange={set("identifiant")}
                placeholder="awa"
                autoComplete="off"
                className="lowercase"
              />
            </Field>

            <Field
              label="Mot de passe"
              htmlFor="membre-mdp"
              hint={`Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`}
              required
            >
              <Input
                id="membre-mdp"
                value={form.password}
                onChange={set("password")}
                placeholder="à dicter au caissier"
                autoComplete="off"
              />
            </Field>

            {error ? (
              <p role="alert" className="text-xs text-destructive sm:col-span-2">
                {error}
              </p>
            ) : null}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending || !complet}>
                <UserPlus aria-hidden />
                {pending ? "Création…" : "Créer le compte"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
