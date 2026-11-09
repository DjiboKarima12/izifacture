import { describe, expect, it } from "vitest";

import { subscriptionRequestMessage, subscriptionRequestUrl } from "@/lib/billing";
import { subscriptionRequestSchema } from "@/lib/domain/schemas";
import { formatAmount } from "@/lib/money";

const context = { orgId: "0b7c1f6e-0000-4000-8000-000000000001", orgName: "Boutique Amina" };

describe("subscriptionRequestSchema", () => {
  it("accepte un numéro nigérien de 8 chiffres, espaces compris", () => {
    const parsed = subscriptionRequestSchema.safeParse({
      period: "monthly",
      country: "NE",
      phone: "89 35 35 00",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse un numéro à la mauvaise longueur pour le pays", () => {
    const parsed = subscriptionRequestSchema.safeParse({
      period: "monthly",
      country: "SN",
      phone: "89353500",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["phone"]);
  });

  it("refuse un pays hors liste et une période inconnue", () => {
    expect(
      subscriptionRequestSchema.safeParse({ period: "monthly", country: "FR", phone: "612345678" })
        .success,
    ).toBe(false);
    expect(
      subscriptionRequestSchema.safeParse({ period: "weekly", country: "NE", phone: "89353500" })
        .success,
    ).toBe(false);
  });
});

describe("subscriptionRequestMessage", () => {
  it("contient tout ce qu'il faut pour activer l'abonnement à la main", () => {
    const message = subscriptionRequestMessage(
      { period: "annual", country: "NE", phone: "89 35 35 00" },
      context,
    );
    expect(message).toContain("Boutique : Boutique Amina");
    expect(message).toContain("Annuel (12 mois)");
    expect(message).toContain(`Montant : ${formatAmount(20_000)}`);
    expect(message).toContain("+227 89353500 (Niger)");
    expect(message).toContain(context.orgId);
  });

  it("ouvre la conversation WhatsApp du support avec le message prérempli", () => {
    const url = subscriptionRequestUrl({ period: "monthly", country: "NE", phone: "89353500" }, context);
    expect(url.startsWith("https://wa.me/22789353500?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toContain("Mensuel (1 mois)");
  });
});
