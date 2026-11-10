import { describe, expect, it } from "vitest";

import { formatAmount } from "@/lib/money";
import { reminderMessage, shareMessage, whatsappPhone, whatsappUrl } from "@/lib/share";

describe("whatsappPhone", () => {
  it("complète un numéro local avec l'indicatif du pays", () => {
    expect(whatsappPhone("90 12 34 56", "Niger")).toBe("22790123456");
    expect(whatsappPhone("77 123 45 67", "Sénégal")).toBe("221771234567");
    expect(whatsappPhone("90123456", "NE")).toBe("22790123456");
  });

  it("garde un numéro déjà international", () => {
    expect(whatsappPhone("+227 90 12 34 56", "Mali")).toBe("22790123456");
    expect(whatsappPhone("00227 90123456")).toBe("22790123456");
    expect(whatsappPhone("227 90 12 34 56", "Niger")).toBe("22790123456");
  });

  it("essaie le pays du client, puis celui de la boutique", () => {
    expect(whatsappPhone("90123456", null, "Niger")).toBe("22790123456");
  });

  it("ne devine pas un numéro incomplet", () => {
    expect(whatsappPhone("1234", "Niger")).toBeNull();
    expect(whatsappPhone(null, "Niger")).toBeNull();
    expect(whatsappPhone("90123456", "France")).toBeNull();
  });
});

const DOC = {
  type: "invoice" as const,
  number: "FAC-2026-0128",
  total: 4_760,
  remaining: 1_760,
  currency: "XOF" as const,
  clientName: "Awa",
  issuerName: "MaMa'S Food",
  url: "https://exemple.test/f/abc",
};

describe("messages", () => {
  it("annonce le document, son montant et son lien", () => {
    const texte = shareMessage(DOC);
    expect(texte).toContain("Bonjour Awa,");
    expect(texte).toContain(`votre facture FAC-2026-0128 d'un montant de ${formatAmount(4_760)}`);
    expect(texte).toContain(DOC.url);
  });

  it("relance avec le reste dû, poliment selon l'échéance", () => {
    expect(reminderMessage({ ...DOC, overdue: true })).toContain("arrivée à échéance");
    expect(reminderMessage({ ...DOC, overdue: false })).toContain("petit rappel");
    expect(reminderMessage({ ...DOC, overdue: false })).toContain(
      `Reste à régler : ${formatAmount(1_760)}.`,
    );
  });

  it("ouvre le choix du contact sans numéro", () => {
    expect(whatsappUrl(null, "a b")).toBe("https://wa.me/?text=a%20b");
    expect(whatsappUrl("22790123456", "a")).toBe("https://wa.me/22790123456?text=a");
  });
});
