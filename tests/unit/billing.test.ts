import { describe, expect, it } from "vitest";

import {
  premiumCheckoutPath,
  premiumSignupPath,
  subscriptionRequestMessage,
  subscriptionRequestUrl,
} from "@/lib/billing";
import { safeNextPath } from "@/lib/auth/next-path";
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

describe("premiumSignupPath", () => {
  it("mène à l'inscription, puis au paiement de la période choisie", () => {
    const path = premiumSignupPath("annual");
    expect(path.startsWith("/signup?next=")).toBe(true);
    const next = new URLSearchParams(path.split("?")[1]).get("next");
    expect(next).toBe(premiumCheckoutPath("annual"));
    expect(safeNextPath(next)).toBe("/abonnement?periode=annual&payer=1");
  });
});

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("refuse toute destination externe ou mal formée", () => {
    expect(safeNextPath("https://faux-site.example")).toBeNull();
    expect(safeNextPath("//faux-site.example")).toBeNull();
    expect(safeNextPath("/\\faux-site.example")).toBeNull();
    expect(safeNextPath("dashboard")).toBeNull();
    expect(safeNextPath(["/a", "/b"])).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
