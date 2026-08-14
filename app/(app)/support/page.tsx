import type { Metadata } from "next";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Aide et Support" };

const CHANNELS = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    detail: "+221 77 000 00 00",
    description: "Le plus rapide, du lundi au samedi de 8h à 20h.",
  },
  {
    icon: Mail,
    title: "Email",
    detail: "support@izifacture.com",
    description: "Réponse sous 24 heures ouvrées.",
  },
  {
    icon: Phone,
    title: "Téléphone",
    detail: "+221 33 000 00 00",
    description: "Du lundi au vendredi, 9h à 18h.",
  },
];

export default function SupportPage() {
  return (
    <PageShell className="max-w-[900px] pt-0">
      <PageHeader
        title="Aide et Support"
        description="Une question sur une facture, la TVA ou votre abonnement ? Écrivez-nous."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((channel) => (
          <Card key={channel.title} className="p-5">
            <span
              className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground"
              aria-hidden
            >
              <channel.icon className="size-[18px]" />
            </span>
            <p className="mt-3 font-semibold">{channel.title}</p>
            <p className="mt-0.5 text-sm font-medium">{channel.detail}</p>
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
