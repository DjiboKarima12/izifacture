import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Barcode, FileText, Hash, Printer, Wallet } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Atouts } from "@/components/marketing/atouts";
import { ReceiptDemo } from "@/components/marketing/receipt-demo";
import { Reveal } from "@/components/marketing/reveal";
import { Tarifs } from "@/components/marketing/tarifs";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/plan";
import { formatAmount } from "@/lib/money";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/pricing";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/domain/types";

export const metadata: Metadata = {
  title: "MaMaFacture — Facturez au comptoir, reçu en main",
  description:
    "Facture, devis, encaissement et reçu imprimé pour les commerces d'Afrique de l'Ouest. " +
    "Scannez vos produits, rendez la monnaie, imprimez le ticket. " +
    `Essai gratuit de ${TRIAL_DAYS} jours, sans carte bancaire.`,
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

const DEVISE = "XOF" as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* ==================================================== Bande sombre */}
      <div className="bg-sidebar text-sidebar-foreground">
        <header className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-3 sm:px-6">
          <Logo onSidebar />

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Accès au compte">
            <Link
              href="/login"
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Connexion
            </Link>
            <Button asChild size="sm" className="h-8 px-2.5 text-xs">
              <Link href="/signup">S&apos;inscrire</Link>
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
                      Essayer gratuitement
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
                  {TRIAL_DAYS} jours d&apos;essai gratuit. Sans carte bancaire.
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
        SUR FOND CLAIR, et c'est la carte du premium qui porte le sombre. La
        version précédente posait tout sur une bande brune ; la grille a depuis
        des sélecteurs de période et de devise, qui demandent un fond calme pour
        rester lisibles. Le détail des cartes vit dans `Tarifs`.
      */}
      <section id="tarifs" className="mx-auto max-w-[1120px] px-4 pb-10 pt-16 sm:px-6 sm:pb-14 sm:pt-24">
        <Reveal>
          <h2 className="tabular mx-auto max-w-[22ch] text-center text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {formatAmount(PREMIUM_MONTHLY_PRICE)} par mois, le jour où vous en aurez besoin.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-center text-muted-foreground">
            Essayez {TRIAL_DAYS} jours gratuitement, sans carte bancaire. Ensuite, le
            Premium pour continuer — sans engagement, payé par Mobile Money.
          </p>
        </Reveal>

        <div className="mt-10">
          <Tarifs />
        </div>
      </section>

      {/* =========================================================== Contact */}
      {/*
        CE BLOC ÉTAIT SOMBRE. Une suite de surfaces brunes se lisait comme un
        écho, et chacune perdait ce qui en faisait l'accent. Le sombre reste
        réservé à deux moments : l'ouverture, et la carte du premium.
      */}
      <section className="mx-auto max-w-[1120px] px-4 pb-12 sm:px-6 sm:pb-16">
        <Reveal>
          <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Une question avant de commencer ?
            </h2>
            <p className="mt-4 max-w-[46ch] text-muted-foreground">
              On répond sur WhatsApp, en français, depuis Niamey.
            </p>

            <dl className="mt-7 grid gap-6 sm:grid-cols-3">
              {[
                {
                  terme: "WhatsApp",
                  valeur: "+227 89 35 35 00",
                  href: "https://wa.me/22789353500",
                },
                {
                  terme: "Email",
                  valeur: "barketechnologie@gmail.com",
                  href: "mailto:barketechnologie@gmail.com",
                },
                { terme: "Adresse", valeur: "Niamey, Niger" },
              ].map((contact) => (
                <div key={contact.terme}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {contact.terme}
                  </dt>
                  <dd className="mt-1.5 break-words font-medium">
                    {contact.href ? (
                      <a
                        href={contact.href}
                        {...(contact.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="rounded-md transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {contact.valeur}
                      </a>
                    ) : (
                      contact.valeur
                    )}
                  </dd>
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
