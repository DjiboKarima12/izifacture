import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Barcode, Check, FileText, Hash, Printer, Wallet } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Atouts } from "@/components/marketing/atouts";
import { ReceiptDemo } from "@/components/marketing/receipt-demo";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FREE_MONTHLY_QUOTA } from "@/lib/plan";
import { formatAmount } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/domain/types";

export const metadata: Metadata = {
  title: "MaMaFacture — Facturez au comptoir, reçu en main",
  description:
    "Facture, devis, encaissement et reçu imprimé pour les commerces d'Afrique de l'Ouest. " +
    "Scannez vos produits, rendez la monnaie, imprimez le ticket. " +
    "Gratuit jusqu'à cinq factures par mois.",
};

/**
 * Page d'accueil publique.
 *
 * Ne DOIT PAS appeler `getSession()` : celui-ci redirige vers /login sans
 * utilisateur, ce qui rendrait la page inaccessible à ceux qu'elle vise.
 *
 * PARTI PRIS : une bande sombre en haut, le reste clair. La première version
 * reprenait les surfaces de l'application — cartes claires sur fond clair — et
 * ressemblait à un écran de réglages. Une vitrine a besoin d'un point d'ancrage
 * visuel, pas d'une grille régulière.
 *
 * Les couleurs restent des JETONS : la bande sombre emprunte ceux de la barre
 * latérale, qui sont déjà un fond sombre validé en contraste. Aucune couleur
 * n'est inventée pour cette page.
 */

const PRIX_PREMIUM = 2_000;
const DEVISE = "XOF" as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* ==================================================== Bande sombre */}
      <div className="bg-sidebar text-sidebar-foreground">
        <header className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:px-6">
          <Logo onSidebar />

          <nav className="ml-auto flex items-center gap-2" aria-label="Accès au compte">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Se connecter
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Créer un compte</Link>
            </Button>
          </nav>
        </header>

        <section className="mx-auto max-w-[1120px] px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              {/* Cascade : chaque bloc entre 90 ms après le précédent. */}
              <Reveal>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-muted">
                  Facturation · Afrique de l&apos;Ouest
                </p>
              </Reveal>

              <Reveal delay={90}>
                <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
                  Le client paie.
                  <br />
                  Le reçu sort.
                  <br />
                  <span className="text-sidebar-mark">Au suivant.</span>
                </h1>
              </Reveal>

              <Reveal delay={180}>
                <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-sidebar-muted sm:text-lg">
                  Scannez l&apos;article, encaissez, rendez la monnaie, imprimez le ticket.
                  MaMaFacture tient la caisse pendant que vous servez.
                </p>
              </Reveal>

              <Reveal delay={270}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/signup">
                      Créer mon compte gratuitement
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                  <Link
                    href="#tarifs"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-sidebar-muted underline-offset-4 transition-colors hover:text-sidebar-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Voir les tarifs
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={360}>
                <p className="mt-5 text-sm text-sidebar-muted">
                  {FREE_MONTHLY_QUOTA} factures par mois offertes. Sans carte bancaire.
                </p>
              </Reveal>
            </div>

            {/*
              Le ticket se fabrique sous les yeux du visiteur, en boucle. C'est
              le VRAI composant du produit à chaque étape, pas une vidéo : ce
              qu'on regarde se construire est exactement ce que le client
              recevra.
            */}
            <Reveal delay={180} className="mx-auto w-full max-w-[300px] lg:mx-0">
              <ReceiptDemo currency={DEVISE} />
            </Reveal>
          </div>
        </section>
      </div>

      {/* ================================================= Moyens de paiement */}
      <div className="border-b border-border bg-background">
        <Reveal className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Les paiements d&apos;ici
            </p>
            <ul className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* ============================================================ Atouts */}
      {/*
        Fond APPUYÉ. Sur la surface ordinaire, la section se distinguait du reste
        de quelques points de luminosité et la page paraissait plate et blanche.
        Ici les rangées se posent sur quelque chose.
      */}
      <section className="bg-surface-strong">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="max-w-[20ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Tout ce qu&apos;une caisse doit faire. Rien de plus.
            </h2>
          </Reveal>

          <Atouts />
        </div>
      </section>

      {/* ============================================================ Tarifs */}
      {/*
        BANDE SOMBRE, comme le haut de la page. Deux cartes claires côte à côte
        sur fond clair donnaient deux rectangles sans hiérarchie : rien ne disait
        laquelle regarder, et la section entière disparaissait dans le blanc.

        Ici le fond bascule sur le brun de la barre latérale, et les deux formules
        s'y posent différemment. Le gratuit reste DANS la bande — bordé, à peine
        détaché, il appartient au fond. Le premium en SORT : carte crème, ombre
        portée, il flotte au-dessus. La hiérarchie passe par la profondeur, pas
        par une bordure de marque, que le système refuse.

        Le gratuit garde pour autant sa liste complète et son bouton : il est
        discret, pas escamoté. C'est l'offre par laquelle presque tout le monde
        entrera.
      */}
      <section id="tarifs" className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="tabular max-w-[18ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {formatAmount(PRIX_PREMIUM, DEVISE)} par mois, le jour où vous en aurez besoin.
            </h2>
            <p className="mt-5 max-w-[52ch] text-sidebar-muted">
              Pas d&apos;engagement, pas de carte bancaire. Vous passez au premium quand les{" "}
              {FREE_MONTHLY_QUOTA} factures gratuites ne suffisent plus — pas avant.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:items-start">
            {/* ------------------------------------------------------ Gratuit */}
            <Reveal>
              <div className="h-full rounded-xl border border-sidebar-border bg-sidebar-active p-7">
                <h3 className="text-base font-semibold">Gratuit</h3>
                <p className="tabular mt-4 text-4xl font-bold tracking-tight">
                  {formatAmount(0, DEVISE)}
                </p>
                <p className="mt-1.5 text-sm text-sidebar-muted">Pour toujours.</p>

                <ul className="mt-7 space-y-3 text-sm">
                  {[
                    `${FREE_MONTHLY_QUOTA} factures par mois`,
                    "Reçus imprimés et PDF",
                    "Clients et encaissements",
                    "Tableau de bord",
                  ].map((ligne) => (
                    <li key={ligne} className="flex items-start gap-2.5">
                      {/*
                        L'or de la marque, et non le vert des statuts : sur le
                        brun, ce vert-là tombe sous le seuil de lisibilité.
                      */}
                      <Check className="mt-0.5 size-4 shrink-0 text-sidebar-mark" aria-hidden />
                      {ligne}
                    </li>
                  ))}
                </ul>

                <Button asChild variant="sidebar" className="mt-8 w-full">
                  <Link href="/signup">Commencer gratuitement</Link>
                </Button>
              </div>
            </Reveal>

            {/* ------------------------------------------------------ Premium */}
            <Reveal delay={80}>
              {/* `shadow-raised` et rien d'autre : c'est l'ombre qui décolle la
                  carte du fond sombre. Une bordure colorée est refusée. */}
              <Card className="shadow-raised h-full p-7">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">Premium</h3>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-foreground">
                    Sans limite
                  </span>
                </div>

                <p className="tabular mt-4 text-4xl font-bold tracking-tight">
                  {formatAmount(PRIX_PREMIUM, DEVISE)}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">par mois.</p>

                <ul className="mt-7 space-y-3 text-sm">
                  {[
                    "Factures sans limite",
                    "Devis et avoirs",
                    "Catalogue produits et douchette",
                    "Plusieurs utilisateurs sur la même boutique",
                    "Support par WhatsApp",
                    "Tout ce que contient le plan gratuit",
                  ].map((ligne) => (
                    <li key={ligne} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-status-paid" aria-hidden />
                      {ligne}
                    </li>
                  ))}
                </ul>

                <Button asChild className="mt-8 w-full">
                  <Link href="/signup">Créer mon compte</Link>
                </Button>

                <p className="mt-4 text-xs text-muted-foreground">
                  Au-delà du quota gratuit, vos brouillons sont conservés. Rien n&apos;est perdu.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =========================================================== Contact */}
      {/*
        CE BLOC ÉTAIT SOMBRE LUI AUSSI. Depuis que les tarifs occupent une bande
        brune pleine largeur, un second brun juste en dessous se lisait comme un
        écho : la moitié basse de la page devenait une suite de rectangles
        foncés, et la bande des tarifs perdait ce qui en faisait l'accent.

        Le sombre reste donc réservé à deux moments — l'ouverture et le prix.
      */}
      <section className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <div className="rounded-xl border border-border bg-surface p-8 shadow-card sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Une question avant de commencer ?
            </h2>
            <p className="mt-4 max-w-[46ch] text-muted-foreground">
              On répond sur WhatsApp, en français, depuis Niamey.
            </p>

            <dl className="mt-9 grid gap-6 sm:grid-cols-3">
              {[
                { terme: "WhatsApp", valeur: "+227 89 35 35 00" },
                { terme: "Email", valeur: "barketechnologie@gmail.com" },
                { terme: "Adresse", valeur: "Niamey, Niger" },
              ].map((contact) => (
                <div key={contact.terme}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {contact.terme}
                  </dt>
                  <dd className="mt-1.5 break-words font-medium">{contact.valeur}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p className="sm:ml-auto">
            Facturation pour les commerces d&apos;Afrique de l&apos;Ouest.
          </p>
        </div>
      </footer>
    </div>
  );
}
