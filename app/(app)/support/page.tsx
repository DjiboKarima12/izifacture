import type { Metadata } from "next";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Aide et Support" };

/**
 * Canaux de support.
 *
 * Un numéro et une adresse email en texte brut obligent l'utilisateur à les
 * recopier à la main — sur téléphone, là où cette page est le plus consultée,
 * c'est le geste le plus pénible qui soit. Chaque canal joignable porte donc son
 * `href` : `wa.me` ouvre la conversation WhatsApp, `tel:` déclenche l'appel,
 * `mailto:` le brouillon. L'adresse postale, elle, n'est qu'une information.
 */
const CHANNELS = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    detail: "+227 89 35 35 00",
    href: "https://wa.me/22789353500",
    external: true,
    description: "Le plus rapide, du lundi au samedi de 9h à 20h.",
  },
  {
    icon: Mail,
    title: "Email",
    detail: "barketechnologie@gmail.com",
    href: "mailto:barketechnologie@gmail.com",
    external: false,
    description: "Réponse sous 24 heures ouvrées.",
  },
  {
    icon: Phone,
    title: "Téléphone",
    detail: "+227 89 35 35 00",
    href: "tel:+22789353500",
    external: false,
    description: "Du lundi au vendredi, 9h à 18h.",
  },
  {
    icon: MapPin,
    title: "Adresse",
    detail: "Niamey, Niger",
    href: null,
    external: false,
    description: "Siège social de Barke Technologie.",
  },
];

export default function SupportPage() {
  return (
    <PageShell className="max-w-[900px] pt-0">
      <PageHeader
        title="Aide et Support"
        description="Une question sur une facture, la TVA ou votre abonnement ? Écrivez-nous."
      />

      {/*
        Deux colonnes, pas quatre : sur 900 px de large, quatre cartes laissaient
        200 px par carte et l'adresse email y était coupée en plein milieu.
      */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <Card key={channel.title} className="p-5">
            <span
              className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground"
              aria-hidden
            >
              <channel.icon className="size-[18px]" />
            </span>
            <p className="mt-3 font-semibold">{channel.title}</p>

            {channel.href ? (
              <a
                href={channel.href}
                target={channel.external ? "_blank" : undefined}
                rel={channel.external ? "noreferrer" : undefined}
                className="mt-0.5 inline-block break-words rounded-md text-sm font-medium text-interactive underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {channel.detail}
              </a>
            ) : (
              <p className="mt-0.5 break-words text-sm font-medium">{channel.detail}</p>
            )}

            <p className="mt-1.5 text-xs text-muted-foreground">{channel.description}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Questions fréquentes</h2>
          <dl className="mt-4 divide-y divide-border">
            {[
              {
                q: "Puis-je modifier une facture déjà envoyée ?",
                a: "Non. Une facture émise est figée, comme l'exige la réglementation. Pour la corriger, créez un avoir depuis la facture concernée.",
              },
              {
                q: "Comment est calculée la TVA ?",
                a: "La TVA est calculée ligne par ligne au taux indiqué (18 % par défaut, modifiable dans les paramètres), puis arrondie au franc. Les totaux affichés sont donc toujours la somme exacte des lignes.",
              },
              {
                q: "Que se passe-t-il si je supprime un brouillon ?",
                a: "Rien d'autre que sa suppression : un brouillon ne consomme aucun numéro de facture, la numérotation reste continue.",
              },
            ].map((item) => (
              <div key={item.q} className="py-4 first:pt-0 last:pb-0">
                <dt className="text-sm font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </PageShell>
  );
}
