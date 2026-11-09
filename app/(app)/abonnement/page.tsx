import type { Metadata } from "next";

import { SubscribePanel } from "@/components/billing/subscribe-panel";
import { PageShell } from "@/components/layout/page-shell";
import { PlanBadge } from "@/components/layout/plan-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDateLong, toIsoDate } from "@/lib/dates";
import { monthBounds, planOf, quotaState } from "@/lib/plan";

export const metadata: Metadata = { title: "Abonnement" };

/**
 * Formule de l'organisation et passage au premium.
 *
 * Le plan et le compteur sont relus à chaque rendu, comme dans le layout et la
 * barrière d'émission : un abonnement activé à la main se voit au rechargement,
 * sans reconnexion.
 */
export default async function AbonnementPage() {
  const session = await getSession();
  const { from, to } = monthBounds();

  const [subscription, issued] = await Promise.all([
    repositories.organizations.getSubscription(session.orgId),
    repositories.invoices.countIssuedBetween(session.orgId, from, to),
  ]);

  const plan = planOf(subscription);
  const quota = quotaState(plan, issued);
  const finPeriode =
    plan === "premium" && subscription.currentPeriodEnd
      ? formatDateLong(toIsoDate(new Date(subscription.currentPeriodEnd)))
      : null;

  return (
    <PageShell className="max-w-[900px] pt-0">
      <PageHeader
        title="Abonnement"
        description="Votre formule, et le passage au Premium par Mobile Money."
      />

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Formule actuelle</h2>
          <PlanBadge plan={plan} />
        </div>

        {quota.limit === null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Factures sans limite
            {finPeriode ? `, jusqu'au ${finPeriode}.` : "."}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="tabular font-semibold text-foreground">
                {quota.used} / {quota.limit}
              </span>{" "}
              factures émises ce mois-ci.
              {quota.reached
                ? " La limite est atteinte : vos brouillons sont conservés."
                : null}
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Factures émises ce mois-ci"
              aria-valuemin={0}
              aria-valuemax={quota.limit}
              aria-valuenow={Math.min(quota.used, quota.limit)}
            >
              <div
                className={quota.reached ? "h-full bg-destructive" : "h-full bg-primary"}
                style={{ width: `${Math.min(100, (quota.used * 100) / quota.limit)}%` }}
              />
            </div>
          </>
        )}
      </Card>

      <div className="mt-4">
        <SubscribePanel
          context={{ orgId: session.orgId, orgName: session.organization.name }}
          isRenewal={plan === "premium"}
        />
      </div>
    </PageShell>
  );
}
