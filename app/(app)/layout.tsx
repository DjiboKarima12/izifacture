import Link from "next/link";

import { TrialEndedDialog } from "@/components/billing/trial-ended-dialog";
import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PlanBadge } from "@/components/layout/plan-badge";
import { Sidebar } from "@/components/layout/sidebar";
import { TopSearch } from "@/components/layout/top-search";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { planOf, trialState } from "@/lib/plan";
import { supabaseDataEnabled } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // À l'étape 4, la redirection vers /login se posera ici — dans le layout
  // serveur, pas dans le middleware (cf. CVE-2025-29927).
  const session = await getSession();

  /**
   * Le plan est relu à chaque rendu de page plutôt que porté par la session : un
   * abonnement activé pendant que l'application est ouverte doit se voir tout de
   * suite, sans reconnexion — c'est la même règle que la barrière du quota.
   */
  const subscription = await repositories.organizations.getSubscription(session.orgId);
  const plan = planOf(subscription);
  // Hors premium actif, l'essai écoulé (ou le premium échu) ouvre la fenêtre
  // qui propose l'abonnement. Elle informe ; la barrière est dans assertCanIssue.
  const termine = plan === "free" && trialState(session.organization.createdAt).expired;
  const canSignOut = supabaseDataEnabled();

  return (
    <div className="min-h-screen bg-surface">
      {/* `print:hidden` : la feuille imprimée ne doit contenir que le document. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] bg-sidebar lg:block print:hidden">
        <Sidebar user={session.user} plan={plan} canSignOut={canSignOut} />
      </aside>

      <div className="lg:pl-[236px] print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6 print:hidden">
          <MobileNav user={session.user} plan={plan} canSignOut={canSignOut} />

          {/* La marque n'apparaît ici qu'en mobile : ailleurs elle est dans la
              barre latérale, et la répéter volerait la place du reste. */}
          <Link href="/dashboard" className="lg:hidden">
            <Logo />
          </Link>
          <PlanBadge plan={plan} className="lg:hidden" />

          {/*
            Rien d'autre que la recherche ici. L'aide et la déconnexion vivent
            déjà dans la barre latérale, et l'adresse du compte y figure en
            entier — la répéter en haut donnait « karimadjibo6… », un libellé
            tronqué qui n'apprend rien et prend la place de la recherche.
          */}
          <div className="ml-auto flex items-center">
            <TopSearch />
          </div>
        </header>

        {children}
      </div>
      {termine ? (
        <TrialEndedDialog reason={subscription.plan === "premium" ? "premium" : "trial"} />
      ) : null}
    </div>
  );
}
