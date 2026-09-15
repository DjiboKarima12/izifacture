import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, Globe, Palette, Sparkles, UserRound, Users } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { AppearancePanel } from "@/components/settings/appearance-panel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrganizationForm, type SettingsTab } from "@/components/settings/organization-form";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Paramètres" };

/**
 * L'onglet actif vit dans l'URL plutôt que dans un état React : le lien est
 * partageable, et la navigation fonctionne même sans JavaScript — ce qui compte
 * sur les connexions visées.
 */
const TABS = [
  { id: "profil", label: "Profil de l'entreprise", icon: Building2 },
  { id: "regional", label: "Régional & Devise", icon: Globe },
  { id: "modeles", label: "Modèles de facturation", icon: FileText },
  { id: "equipe", label: "Équipe & Accès", icon: Users },
  { id: "apparence", label: "Apparence", icon: Palette },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROLE_LABELS = { owner: "Propriétaire", admin: "Administrateur", member: "Membre" };

function SettingsNav({ active }: { active: TabId }) {
  return (
    <nav aria-label="Sections des paramètres">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0 lg:shrink">
              <Link
                href={`/settings?tab=${tab.id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <tab.icon
                  className={cn("size-4 shrink-0", isActive && "text-interactive")}
                  aria-hidden
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();

  const active: TabId = TABS.some((tab) => tab.id === searchParams.tab)
    ? (searchParams.tab as TabId)
    : "profil";

  // Les onglets de formulaire portent leur propre en-tête : le bouton
  // « Enregistrer » y vit et dépend de l'état de saisie.
  // `equipe` et `apparence` ne sont pas des onglets du formulaire d'organisation :
  // ils ont leur propre contenu.
  if (active !== "equipe" && active !== "apparence") {
    return (
      <PageShell className="max-w-[1040px] pt-0">
        <OrganizationForm
          organization={session.organization}
          tab={active as SettingsTab}
          nav={<SettingsNav active={active} />}
        />
      </PageShell>
    );
  }

  /**
   * L'apparence a sa propre section, comme les autres réglages.
   *
   * Elle vivait au-dessus des membres, dans l'onglet Équipe : deux sujets sans
   * rapport sur le même écran, et un réglage qu'on ne pensait pas à chercher là.
   */
  if (active === "apparence") {
    return (
      <PageShell className="max-w-[1040px] pt-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les configurations générales de votre espace de travail.
          </p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <SettingsNav active={active} />
          <div className="min-w-0">
            <AppearancePanel />
          </div>
        </div>
      </PageShell>
    );
  }

  const members = await repositories.organizations.listMembers(session.orgId);

  return (
    <PageShell className="max-w-[1040px] pt-0">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les configurations générales de votre espace de travail.
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsNav active={active} />

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-base font-semibold">Membres</h2>
              <p className="text-sm text-muted-foreground">
                Les membres partagent les factures et les clients de l&apos;organisation.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-t border-border px-6 py-3.5"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                    aria-hidden
                  >
                    {(member.fullName ?? member.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.fullName ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="ml-auto rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Les membres existants s'affichent ; ce sont les INVITATIONS qui ne
              sont pas encore construites — elles dépendent de l'authentification. */}
          <Card>
            <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                aria-hidden
              >
                <UserRound className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold">Gestion des accès</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Inviter un collaborateur et régler ses droits n&apos;est pas encore disponible.
                  Cette fonction arrive avec l&apos;authentification.
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-1" disabled>
                <Sparkles aria-hidden />
                Mettre à niveau (Pro)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
