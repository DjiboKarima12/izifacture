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

describe("dueReminder", () => {
  it("écrit une seule fois pour l'essai, à trois jours de la fin", () => {
    const target = { ...base, subscription: free };
    expect(dueReminder(target, new Date("2026-12-12T11:00:00Z"))).toBeNull();
    expect(dueReminder(target, new Date("2026-12-13T11:00:00Z"))?.daysLeft).toBe(3);
    expect(dueReminder(target, new Date("2026-12-14T11:00:00Z"))).toBeNull();
  });

  it("écrit une seule fois pour le Premium, à cinq jours de la fin", () => {
    const target = { ...base, subscription: premium };
    expect(dueReminder(target, new Date("2027-01-04T06:00:00Z"))).toBeNull();
    expect(dueReminder(target, new Date("2027-01-05T06:00:00Z"))?.kind).toBe("premium");
    expect(dueReminder(target, new Date("2027-01-06T06:00:00Z"))).toBeNull();
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
});
