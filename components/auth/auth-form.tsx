"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { signIn, signUp } from "@/lib/actions/auth";

/**
 * Connexion et inscription.
 *
 * Un seul composant pour les deux : les champs communs, leur validation et leur
 * disposition doivent rester identiques, sinon les deux écrans divergent au
 * premier ajustement.
 */
export function AuthForm({
  mode,
  next = null,
}: {
  mode: "signin" | "signup";
  /** Destination après succès, déjà vérifiée par `safeNextPath()`. */
  next?: string | null;
}) {
  const router = useRouter();
  const isSignUp = mode === "signup";
  // Le visiteur vient du bouton premium de la vitrine : on le lui rappelle,
  // sinon le formulaire d'inscription seul laisse croire qu'il s'est trompé.
  const vaPayer = next?.startsWith("/abonnement") ?? false;
  const autreEcran = isSignUp ? "/login" : "/signup";

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [form, setForm] = React.useState({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = isSignUp ? await signUp(form) : await signIn(form);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Sans session après inscription, la confirmation par email est activée.
      if (isSignUp) {
        setNotice(
          "Compte créé. Si un email de confirmation vous a été envoyé, suivez le lien avant de vous connecter.",
        );
      }
      router.push(next ?? "/dashboard");
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
              {isSignUp ? "Créer votre compte" : "Connexion"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp
                ? "Quelques informations, et vous facturez."
                : "Accédez à vos factures et à vos clients."}
            </p>

            {vaPayer ? (
              <p className="mt-4 rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-foreground">
                <span className="font-semibold">Formule Premium choisie.</span>{" "}
                {isSignUp ? "Une fois le compte créé" : "Une fois connecté"}, vous passez
                directement au paiement par Mobile Money.
              </p>
            ) : null}

            <form onSubmit={submit} className="mt-6 space-y-4">
              {isSignUp ? (
                <>
                  <Field label="Votre nom" htmlFor="full-name" required>
                    <Input
                      id="full-name"
                      value={form.fullName}
                      onChange={set("fullName")}
                      autoComplete="name"
                      required
                    />
                  </Field>
                  <Field label="Nom de l'entreprise" htmlFor="org-name" required>
                    <Input
                      id="org-name"
                      value={form.organizationName}
                      onChange={set("organizationName")}
                      autoComplete="organization"
                      required
                    />
                  </Field>
                </>
              ) : null}

              {/*
                `type="text"` et non `type="email"` à la connexion : un caissier
                se connecte avec « majida », et le navigateur refusait la saisie
                avant même qu'elle atteigne le serveur. L'inscription garde le
                contrôle du navigateur — un compte qu'on crée soi-même doit
                pouvoir recevoir un lien de réinitialisation.
              */}
              <Field
                label={isSignUp ? "Email" : "Email ou identifiant"}
                htmlFor="email"
                hint={
                  isSignUp ? undefined : "Votre email, ou l'identifiant reçu de votre responsable."
                }
                required
              >
                <Input
                  id="email"
                  type={isSignUp ? "email" : "text"}
                  inputMode="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete={isSignUp ? "email" : "username"}
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </Field>

              <Field
                label="Mot de passe"
                htmlFor="password"
                required
                hint={isSignUp ? "8 caractères minimum." : undefined}
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>

              {!isSignUp ? (
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-interactive underline-offset-4 hover:underline"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending
                  ? "Un instant…"
                  : isSignUp
                    ? "Créer mon compte"
                    : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignUp ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <Link
            href={next ? `${autreEcran}?next=${encodeURIComponent(next)}` : autreEcran}
            className="font-medium text-interactive underline-offset-4 hover:underline"
          >
            {isSignUp ? "Se connecter" : "Créer un compte"}
          </Link>
        </p>
      </div>
    </main>
  );
}
