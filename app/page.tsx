import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Barcode, Check, FileText, Hash, Printer, Wallet } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
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

const ATOUTS = [
  {
    icon: Barcode,
    titre: "Scannez, ne tapez plus",
    texte:
      "Vos articles enregistrés une fois, avec leur prix. Ensuite la douchette suffit : un bip, une ligne. Sans lecteur, le nom se complète à la frappe.",
  },
  {
    icon: Wallet,
    titre: "La monnaie, avant d'ouvrir la caisse",
    texte:
      "Le client donne 5 000 sur 2 950 ? Vous lisez 2 050 à rendre. Il ne donne qu'une partie ? C'est un acompte, et le reçu porte le reste dû.",
  },
  {
    icon: Printer,
    titre: "Le ticket qu'on reconnaît",
    texte:
      "Un reçu de 80 mm, imprimé ou en PDF, avec le code-barres du numéro. Jamais une feuille A4 aux trois quarts vide.",
  },
  {
    icon: FileText,
    titre: "Du devis à la facture",
    texte:
      "Proposez un montant sans rien réclamer. Le devis accepté devient une facture en un clic, sans ressaisir une ligne.",
  },
  {
    icon: Hash,
    titre: "Une numérotation qui tient",
    texte:
      "Chaque document reçoit son numéro à l'émission, sans trou dans la séquence, et se fige. Une erreur se corrige par un avoir, jamais en réécrivant.",
  },
  {
    icon: ArrowRight,
    titre: "Vos chiffres sans cahier",
    texte:
      "Encaissé du mois, factures en attente, retards. Vous savez qui vous doit quoi sans feuilleter quoi que ce soit.",
  },
];

const DEMO_LIGNES = [
  { id: "1", description: "Attiéké poisson", quantity: 2, unitPrice: 1_500, taxRate: 19 },
  { id: "2", description: "Jus de bissap", quantity: 2, unitPrice: 500, taxRate: 19 },
];

export default function HomePage() {
  const sousTotal = DEMO_LIGNES.reduce((somme, ligne) => somme + ligne.quantity * ligne.unitPrice, 0);
  const tva = Math.round(sousTotal * 0.19);
  const total = sousTotal + tva;

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
              Le VRAI composant du produit, incliné et décollé du fond : ce que
              le visiteur regarde est exactement ce que son client recevra. Une
              capture retouchée promettrait autre chose que ce qu'on livre.
            */}
            <Reveal delay={180} className="mx-auto w-full max-w-[300px] lg:mx-0">
              <div className="rotate-2 shadow-raised transition-transform hover:rotate-0">
                <InvoicePreview
                  issuer={{
                    name: "MaMa'S Food",
                    legalName: null,
                    email: null,
                    phone: "+227 89 35 35 00",
                    addressLine: null,
                    city: "Niamey",
                    country: "Niger",
                    taxId: null,
                    invoiceFooter: "Merci Karima !",
                    logoUrl: null,
                  }}
                  client={null}
                  currency={DEVISE}
                  number="FAC-2026-0128"
                  issueDate="2026-09-15"
                  dueDate="2026-09-15"
                  lines={DEMO_LIGNES.map((ligne) => ({
                    ...ligne,
                    lineSubtotal: ligne.quantity * ligne.unitPrice,
                    lineTotal: Math.round(ligne.quantity * ligne.unitPrice * 1.19),
                  }))}
                  totals={{
                    subtotal: sousTotal,
                    discountTotal: 0,
                    taxTotal: tva,
                    total,
                    taxBreakdown: [{ rate: 19, base: sousTotal, tax: tva }],
                  }}
                  notes=""
                  amountPaid={total}
                  payments={[{ method: "cash", amount: total, tendered: 5_000 }]}
                />
              </div>
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
      <section className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="max-w-[20ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Tout ce qu&apos;une caisse doit faire. Rien de plus.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ATOUTS.map((atout, index) => (
            <Reveal key={atout.titre} delay={(index % 3) * 80}>
              <Card className="h-full p-6 transition-shadow hover:shadow-raised">
                <span
                  className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <atout.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{atout.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{atout.texte}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================================================ Tarifs */}
      <section id="tarifs" className="border-y border-border bg-background">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Deux formules</h2>
            <p className="mt-4 max-w-[52ch] text-muted-foreground">
              Commencez gratuitement. Passez au premium le jour où votre activité le demande,
              pas avant.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <Card className="h-full p-7">
                <h3 className="text-base font-semibold">Gratuit</h3>
                <p className="tabular mt-4 text-4xl font-bold tracking-tight">
                  {formatAmount(0, DEVISE)}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">Pour toujours.</p>

                <ul className="mt-7 space-y-3 text-sm">
                  {[
                    `${FREE_MONTHLY_QUOTA} factures par mois`,
                    "Devis et avoirs sans limite",
                    "Catalogue produits et douchette",
                    "Reçus imprimés et PDF",
                    "Clients, encaissements, tableau de bord",
                  ].map((ligne) => (
                    <li key={ligne} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-status-paid" aria-hidden />
                      {ligne}
                    </li>
                  ))}
                </ul>

                <Button asChild variant="outline" className="mt-8 w-full">
                  <Link href="/signup">Commencer</Link>
                </Button>
              </Card>
            </Reveal>

            <Reveal delay={80}>
              {/* La formule payante se distingue par l'ombre, pas par une bordure
                  colorée : une bordure de marque est refusée par le système. */}
              <Card className="h-full p-7 shadow-raised">
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
                    "Tout ce que contient le plan gratuit",
                    "Plusieurs utilisateurs sur la même boutique",
                    "Support par WhatsApp",
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
      <section className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <div className="rounded-xl bg-sidebar p-8 text-sidebar-foreground shadow-raised sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Une question avant de commencer ?
            </h2>
            <p className="mt-4 max-w-[46ch] text-sidebar-muted">
              On répond sur WhatsApp, en français, depuis Niamey.
            </p>

            <dl className="mt-9 grid gap-6 sm:grid-cols-3">
              {[
                { terme: "WhatsApp", valeur: "+227 89 35 35 00" },
                { terme: "Email", valeur: "barketechnologie@gmail.com" },
                { terme: "Adresse", valeur: "Niamey, Niger" },
              ].map((contact) => (
                <div key={contact.terme}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
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
          <p className="sm:ml-auto">Facturation pour les commerces d&apos;Afrique de l&apos;Ouest.</p>
        </div>
      </footer>
    </div>
  );
}
