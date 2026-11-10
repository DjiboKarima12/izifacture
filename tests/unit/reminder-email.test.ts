import { describe, expect, it } from "vitest";

import { dueReminder, reminderEmail } from "@/lib/email/reminders";

const base = {
  orgId: "o",
  orgName: "Boutique <Awa>",
  orgCreatedAt: "2026-12-01T10:00:00Z",
  ownerEmail: "awa@exemple.test",
  ownerName: "Awa",
};
const free = { plan: "free", status: "active", currentPeriodEnd: null };
const premium = { plan: "premium", status: "active", currentPeriodEnd: "2027-01-10T00:00:00Z" };

/** Ce que renvoie le cron s'il tourne chaque jour à 7 h, du `debut` au `fin` inclus. */
function calendrier(target: Parameters<typeof dueReminder>[0], debut: string, fin: string) {
  const envois: string[] = [];
  for (let t = Date.parse(debut); t <= Date.parse(fin); t += 86_400_000) {
    const r = dueReminder(target, new Date(t));
    if (r) envois.push(`${new Date(t).toISOString().slice(0, 10)} ${r.kind}`);
  }
  return envois;
}

describe("dueReminder", () => {
  it("essai : bienvenue, J-3, fin — une fois chacun", () => {
    expect(calendrier({ ...base, subscription: free }, "2026-12-01T07:00:00Z", "2026-12-25T07:00:00Z")).toEqual([
      "2026-12-02 welcome",
      "2026-12-14 trial-soon",
      "2026-12-17 trial-ended",
    ]);
  });

  it("Premium : J-5, veille, expiration — une fois chacun", () => {
    const target = { ...base, orgCreatedAt: "2026-01-01T10:00:00Z", subscription: premium };
    expect(calendrier(target, "2026-12-30T07:00:00Z", "2027-01-20T07:00:00Z")).toEqual([
      "2027-01-05 premium-soon",
      "2027-01-09 premium-last",
      "2027-01-10 premium-ended",
    ]);
  });

  it("n'annonce pas la fin de l'essai à un abonné Premium", () => {
    const target = { ...base, subscription: premium };
    const envois = calendrier(target, "2026-12-03T07:00:00Z", "2026-12-25T07:00:00Z");
    expect(envois.some((e) => e.includes("trial"))).toBe(false);
  });

  it("ne relance pas un Premium sans échéance", () => {
    const target = {
      ...base,
      orgCreatedAt: "2026-01-01T10:00:00Z",
      subscription: { plan: "premium", status: "active", currentPeriodEnd: null },
    };
    expect(calendrier(target, "2026-12-01T07:00:00Z", "2027-02-01T07:00:00Z")).toEqual([]);
  });
});

describe("reminderEmail", () => {
  it("mène au paiement et échappe le nom de la boutique", () => {
    const target = { ...base, subscription: premium };
    const reminder = dueReminder(target, new Date("2027-01-05T06:00:00Z"))!;
    const email = reminderEmail(target, reminder, "https://site.test");
    expect(email.to).toBe("awa@exemple.test");
    expect(email.subject).toBe("Votre Premium MaMaFacture se termine dans 5 jours");
    expect(email.html).toContain("https://site.test/abonnement?payer=1");
    expect(email.html).toContain("Boutique &lt;Awa&gt;");
    expect(email.html).not.toContain("<Awa>");
  });

  it("souhaite la bienvenue avec un lien vers la première facture", () => {
    const target = { ...base, subscription: free };
    const reminder = dueReminder(target, new Date("2026-12-02T07:00:00Z"))!;
    const email = reminderEmail(target, reminder, "https://site.test");
    expect(email.subject).toBe("Bienvenue sur MaMaFacture");
    expect(email.html).toContain("https://site.test/invoices/new");
  });
});
