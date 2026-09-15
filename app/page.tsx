import type { Metadata } from "next";
import Link from "next/link";
import {
  Barcode,
  Check,
  FileText,
  Hash,
  LayoutDashboard,
  Printer,
  Wallet,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FREE_MONTHLY_QUOTA } from "@/lib/plan";
import { formatAmount } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/domain/types";

export const metadata: Metadata = {
  title: "MaMaFacture — Facturez au comptoir, reçu en main",
  description:
    "Facture, devis, encaissement et reçu imprimé pour les commerces d'Afrique de l'Ouest. " +
    "Scannez vos produits, rendez la monnaie, imprimez le ticket. Gratuit jusqu'à cinq factures par mois.",
};

/**
 * Page d'accueil publique.
 *
 * Ne DOIT PAS appeler `getSession()` : celui-ci redirige vers /login sans
 * utilisateur, ce qui rendrait la page inaccessible à ceux qu'elle vise — des
 * visiteurs qui n'ont pas encore de compte.
 *
 * Elle suit le même design system que l'application, jetons compris. Une vitrine
 * qui ne ressemble pas au produit promet autre chose que ce qu'on livre.
 */

const PRIX_PREMIUM = 2_000;
const DEVISE = "XOF" as const;

const ATOUTS = [
  {
    icon: Barcode,
    titre: "Scannez, ne tapez plus",
    texte:
      "Enregistrez vos articles une fois avec leur prix. Ensuite, la douchette suffit : un bip, une ligne. Sans lecteur, le nom du produit se complète à la frappe.",
  },
  {
    icon: Printer,
    titre: "Le ticket que le client reconnaît",
    texte:
      "Un reçu de 80 mm, à imprimer ou à télécharger, avec le code-barres du numéro. Pas de feuille A4 aux trois quarts vide.",
  },
  {
    icon: Wallet,
    titre: "Encaissez comme au comptoir",
    texte:
      "Le client donne 5 000 sur 2 950 : la monnaie à rendre s'affiche avant que vous ouvriez la caisse. Il ne donne qu'une partie : c'est un acompte, le reçu porte le reste.",
  },
  {
    icon: FileText,
    titre: "Du devis à la facture",
    texte:
      "Proposez un montant sans rien réclamer. Une fois le devis accepté, il devient une facture en un clic, sans ressaisie.",
  },
  {
    icon: LayoutDashboard,
    titre: "Vos chiffres, à jour",
    texte:
      "Encaissé du mois, factures en attente, retards. De quoi savoir qui vous doit quoi sans ouvrir un cahier.",
  },
  {
    icon: Hash,
    titre: "Une numérotation qui tient",
    texte:
      "Chaque document reçoit son numéro à l'émission, sans trou dans la séquence, et se fige. Une erreur se corrige par un avoir, jamais en réécrivant l'histoire.",
  },
];

/** Les lignes du ticket de démonstration. Des vrais plats, des vrais prix. */
const DEMO_LIGNES = [
  { id: "1", description: "Attiéké poisson", quantity: 2, unitPrice: 1_500, taxRate: 19 },
  { id: "2", description: "Jus de bissap", quantity: 2, unitPrice: 500, taxRate: 19 },
];

export default function HomePage() {
  const sousTotal = DEMO_LIGNES.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const tva = Math.round(sousTotal * 0.19);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="ml-auto flex items-center gap-2" aria-label="Accès au compte">
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Créer un compte</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------- Accroche */}
        <section className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Facturation · Afrique de l&apos;Ouest
              </p>

              <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                Facturez au comptoir, le reçu dans la main du client.
              </h1>

              <p className="mt-5 max-w-[52ch] text-base text-muted-foreground sm:text-lg">
                Scannez l&apos;article, encaissez, rendez la monnaie, imprimez le ticket.
                MaMaFacture tient la caisse pendant que vous servez le client suivant.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href="/signup">Créer mon compte gratuitement</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">J&apos;ai déjà un compte</Link>
                </Button>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {FREE_MONTHLY_QUOTA} factures par mois offertes, sans carte bancaire.
              </p>
            </div>

            {/*
              Le vrai composant du produit, pas une image retouchée : ce que le
              visiteur voit ici est exactement ce que son client recevra.
            */}
            <div className="mx-auto w-full max-w-[320px] lg:mx-0">
              <InvoicePreview
                issuer={{
                  name: "Chez Aïcha",
                  legalName: null,
                  email: null,
                  phone: "+227 90 00 00 00",
                  addressLine: null,
                  city: "Niamey",
                  country: "Niger",
                  taxId: null,
                  invoiceFooter: "Merci de votre confiance.",
                  logoUrl: null,
                }}
                client={null}
                currency={DEVISE}
                number="FAC-2026-0128"
                issueDate="2026-09-15"
                dueDate="2026-09-15"
                lines={DEMO_LIGNES.map((l) => ({
                  ...l,
                  lineSubtotal: l.quantity * l.unitPrice,
                  lineTotal: Math.round(l.quantity * l.unitPrice * 1.19),
                }))}
                totals={{
                  subtotal: sousTotal,
                  discountTotal: 0,
                  taxTotal: tva,
                  total: sousTotal + tva,
                  taxBreakdown: [{ rate: 19, base: sousTotal, tax: tva }],
                }}
                notes=""
                amountPaid={sousTotal + tva}
                payments={[{ method: "cash", amount: sousTotal + tva, tendered: 5_000 }]}
              />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- Ce que ça fait */}
        <section className="border-y border-border bg-background">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="max-w-[24ch] text-2xl font-bold tracking-tight sm:text-3xl">
              Tout ce qu&apos;une caisse doit faire, et rien de plus.
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ATOUTS.map((atout) => (
                <Card key={atout.titre} className="p-5">
                  <span
                    className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground"
                    aria-hidden
                  >
                    <atout.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{atout.titre}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{atout.texte}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Moyens de paiement */}
        <section className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Les moyens de paiement d&apos;ici
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium"
              >
                {PAYMENT_METHOD_LABELS[method]}
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-[60ch] text-sm text-muted-foreground">
            Chaque encaissement garde son moyen. Sur le reçu, le client lit ce qu&apos;il a donné
            et ce qu&apos;on lui rend.
          </p>
        </section>

        {/* ----------------------------------------------------------- Tarifs */}
        <section id="tarifs" className="border-t border-border bg-background">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Deux formules</h2>
            <p className="mt-3 max-w-[56ch] text-muted-foreground">
              Commencez gratuitement. Passez au premium le jour où votre activité le demande —
              pas avant.
            </p>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <Card className="p-6">
                <h3 className="text-base font-semibold">Gratuit</h3>
                <p className="tabular mt-3 text-3xl font-bold tracking-tight">
                  {formatAmount(0, DEVISE)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Pour toujours.</p>

                <ul className="mt-6 space-y-2.5 text-sm">
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

                <Button asChild variant="outline" className="mt-7 w-full">
                  <Link href="/signup">Commencer</Link>
                </Button>
              </Card>

              <Card className="p-6 shadow-raised">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">Premium</h3>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-foreground">
                    Sans limite
                  </span>
                </div>

                <p className="tabular mt-3 text-3xl font-bold tracking-tight">
                  {formatAmount(PRIX_PREMIUM, DEVISE)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">par mois.</p>

                <ul className="mt-6 space-y-2.5 text-sm">
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

                <Button asChild className="mt-7 w-full">
                  <Link href="/signup">Créer mon compte</Link>
                </Button>

                {/*
                  Dit franchement : le quota ne détruit rien. C'est la première
                  crainte de quelqu'un qui hésite à commencer sur le gratuit.
                */}
                <p className="mt-4 text-xs text-muted-foreground">
                  Au-delà du quota gratuit, vos brouillons sont conservés. Rien n&apos;est perdu.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Contact */}
        <section className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="rounded-xl border border-border bg-background p-6 shadow-card sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight">Une question avant de commencer ?</h2>
            <p className="mt-3 max-w-[52ch] text-muted-foreground">
              On répond sur WhatsApp, en français, depuis Niamey.
            </p>

            <dl className="mt-7 grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  WhatsApp
                </dt>
                <dd className="tabular mt-1 font-medium">+227 89 35 35 00</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1 break-words font-medium">barketechnologie@gmail.com</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Adresse
                </dt>
                <dd className="mt-1 font-medium">Niamey, Niger</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p className="sm:ml-auto">Facturation pour les commerces d&apos;Afrique de l&apos;Ouest.</p>
        </div>
      </footer>
    </div>
  );
}
