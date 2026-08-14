import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  deriveDisplayStatus,
  isEditable,
  isOutstanding,
  statusAfterPayment,
  statusLabel,
} from "@/lib/status";
import { INVOICE_STATUSES } from "@/lib/domain/types";

describe("canTransition", () => {
  it("autorise le cycle de vie normal", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "partially_paid")).toBe(true);
    expect(canTransition("sent", "paid")).toBe(true);
    expect(canTransition("partially_paid", "paid")).toBe(true);
  });

  it("autorise l'annulation avant paiement complet", () => {
    expect(canTransition("draft", "cancelled")).toBe(true);
    expect(canTransition("sent", "cancelled")).toBe(true);
    expect(canTransition("partially_paid", "cancelled")).toBe(true);
  });

  it("interdit de revenir en arrière", () => {
    expect(canTransition("sent", "draft")).toBe(false);
    expect(canTransition("paid", "sent")).toBe(false);
    expect(canTransition("partially_paid", "sent")).toBe(false);
  });

  it("fige les états terminaux", () => {
    for (const status of INVOICE_STATUSES) {
      expect(canTransition("paid", status)).toBe(false);
      expect(canTransition("cancelled", status)).toBe(false);
    }
  });

  it("interdit de sauter le brouillon vers un état payé", () => {
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("draft", "partially_paid")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("échoue avec un message lisible", () => {
    expect(() => assertTransition("paid", "sent")).toThrow(/Payée → Envoyée/);
  });

  it("passe sur une transition valide", () => {
    expect(() => assertTransition("draft", "sent")).not.toThrow();
  });
});

describe("isEditable", () => {
  it("ne rend modifiable que le brouillon", () => {
    // Immuabilité des documents émis : correction par avoir uniquement.
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("sent")).toBe(false);
    expect(isEditable("partially_paid")).toBe(false);
    expect(isEditable("paid")).toBe(false);
    expect(isEditable("cancelled")).toBe(false);
  });
});

describe("isOutstanding", () => {
  it("identifie les créances en cours", () => {
    expect(isOutstanding("sent")).toBe(true);
    expect(isOutstanding("partially_paid")).toBe(true);
    expect(isOutstanding("draft")).toBe(false);
    expect(isOutstanding("paid")).toBe(false);
    expect(isOutstanding("cancelled")).toBe(false);
  });
});

describe("deriveDisplayStatus", () => {
  const today = "2026-08-12";

  it("marque en retard une facture échue et non soldée", () => {
    expect(deriveDisplayStatus({ status: "sent", dueDate: "2026-08-01" }, today)).toBe("overdue");
    expect(deriveDisplayStatus({ status: "partially_paid", dueDate: "2026-08-01" }, today)).toBe(
      "overdue",
    );
  });

  it("ne marque pas en retard le jour même de l'échéance", () => {
    expect(deriveDisplayStatus({ status: "sent", dueDate: today }, today)).toBe("sent");
  });

  it("n'applique jamais le retard à un brouillon, une facture payée ou annulée", () => {
    expect(deriveDisplayStatus({ status: "draft", dueDate: "2020-01-01" }, today)).toBe("draft");
    expect(deriveDisplayStatus({ status: "paid", dueDate: "2020-01-01" }, today)).toBe("paid");
    expect(deriveDisplayStatus({ status: "cancelled", dueDate: "2020-01-01" }, today)).toBe(
      "cancelled",
    );
  });
});

describe("deriveDisplayStatus — devis", () => {
  const today = "2026-08-12";

  it("marque un devis dépassé « expiré », jamais « en retard »", () => {
    // Un devis ne doit pas d'argent : parler de retard n'aurait aucun sens.
    expect(
      deriveDisplayStatus({ status: "sent", dueDate: "2026-08-01", type: "quote" }, today),
    ).toBe("expired");
  });

  it("laisse une facture dépassée « en retard »", () => {
    expect(
      deriveDisplayStatus({ status: "sent", dueDate: "2026-08-01", type: "invoice" }, today),
    ).toBe("overdue");
  });

  it("ne touche pas à un devis encore valable", () => {
    expect(
      deriveDisplayStatus({ status: "sent", dueDate: "2026-09-01", type: "quote" }, today),
    ).toBe("sent");
  });

  it("traite un document sans type comme une facture", () => {
    expect(deriveDisplayStatus({ status: "sent", dueDate: "2026-08-01" }, today)).toBe("overdue");
  });
});

describe("statusLabel", () => {
  it("accorde au masculin pour un devis", () => {
    expect(statusLabel("sent", "quote")).toBe("Envoyé");
    expect(statusLabel("sent", "invoice")).toBe("Envoyée");
  });

  it("emploie le vocabulaire du devis", () => {
    expect(statusLabel("expired", "quote")).toBe("Expiré");
    expect(statusLabel("cancelled", "quote")).toBe("Refusé");
    expect(statusLabel("paid", "quote")).toBe("Accepté");
  });

  it("garde le vocabulaire de la facture par défaut", () => {
    expect(statusLabel("overdue")).toBe("En retard");
    expect(statusLabel("paid")).toBe("Payée");
  });
});

describe("statusAfterPayment", () => {
  it("passe à payée quand le solde est atteint", () => {
    expect(statusAfterPayment("sent", 118_000, 118_000)).toBe("paid");
    expect(statusAfterPayment("partially_paid", 118_000, 118_000)).toBe("paid");
  });

  it("passe à partiellement payée sur un encaissement partiel", () => {
    expect(statusAfterPayment("sent", 118_000, 50_000)).toBe("partially_paid");
  });

  it("considère un trop-perçu comme payée", () => {
    expect(statusAfterPayment("sent", 118_000, 150_000)).toBe("paid");
  });

  it("revient à envoyée si les encaissements sont annulés", () => {
    expect(statusAfterPayment("partially_paid", 118_000, 0)).toBe("sent");
  });

  it("ne touche ni aux brouillons ni aux factures annulées", () => {
    expect(statusAfterPayment("draft", 118_000, 118_000)).toBe("draft");
    expect(statusAfterPayment("cancelled", 118_000, 118_000)).toBe("cancelled");
  });
});
