"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { resetPassword } from "@/lib/actions/auth";

/**
 * Formulaire de demande de réinitialisation de mot de passe.
 *
 * Le message de confirmation est volontairement identique que le compte existe
 * ou non : un attaquant ne doit pas pouvoir énumérer les comptes.
 */
export default function ForgotPasswordPage() {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await resetPassword({ email });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSent(true);
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
            <h1 className="text-xl font-bold tracking-tight">Mot de passe oublié</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saisissez votre adresse email. Si un compte existe, vous recevrez un
              lien pour réinitialiser votre mot de passe.
            </p>

            {sent ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Si un compte existe avec l&apos;adresse <strong>{email}</strong>, un
                  email contenant un lien de réinitialisation vous a été envoyé.
                  Vérifiez votre boîte de réception et vos spams.
                </p>
                <Link
                  href="/login"
                  className="inline-block text-sm font-medium text-interactive underline-offset-4 hover:underline"
                >
                  ← Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Email" htmlFor="email" required>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </Field>

                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Envoi en cours…" : "Envoyer le lien"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-interactive underline-offset-4 hover:underline"
          >
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
