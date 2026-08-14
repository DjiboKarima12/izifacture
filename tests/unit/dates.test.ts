import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  computeDueDate,
  daysBetween,
  daysOverdue,
  formatDate,
  formatDateLong,
  isBefore,
  isIsoDate,
  todayIso,
} from "@/lib/dates";

describe("isIsoDate", () => {
  it("accepte une date valide", () => {
    expect(isIsoDate("2026-08-12")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  it("rejette les formats et jours invalides", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("12/08/2026")).toBe(false);
    expect(isIsoDate("2026-8-12")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("addDays", () => {
  it("avance et recule dans le calendrier", () => {
    expect(addDays("2026-08-12", 30)).toBe("2026-09-11");
    expect(addDays("2026-08-12", -12)).toBe("2026-07-31");
  });

  it("franchit les fins d'année et les années bissextiles", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
  });
});

describe("addMonths", () => {
  it("borne au dernier jour du mois d'arrivée", () => {
    // Une facture récurrente créée le 31 ne doit pas glisser au 3 mars.
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("gère les cas simples et le passage d'année", () => {
    expect(addMonths("2026-08-12", 1)).toBe("2026-09-12");
    expect(addMonths("2026-08-12", 3)).toBe("2026-11-12");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-08-12", 12)).toBe("2027-08-12");
  });
});

describe("daysBetween", () => {
  it("compte les jours entiers", () => {
    expect(daysBetween("2026-08-12", "2026-08-22")).toBe(10);
    expect(daysBetween("2026-08-22", "2026-08-12")).toBe(-10);
    expect(daysBetween("2026-08-12", "2026-08-12")).toBe(0);
  });

  it("reste juste malgré les changements d'heure", () => {
    // Bornes qui encadrent les bascules d'heure d'été de l'hémisphère nord.
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });
});

describe("computeDueDate", () => {
  it("applique le délai de paiement", () => {
    expect(computeDueDate("2026-08-12", 30)).toBe("2026-09-11");
    expect(computeDueDate("2026-08-12", 0)).toBe("2026-08-12");
  });

  it("rejette un délai invalide", () => {
    expect(() => computeDueDate("2026-08-12", -5)).toThrow(/délai de paiement/);
    expect(() => computeDueDate("2026-08-12", 1.5)).toThrow(/délai de paiement/);
  });
});

describe("daysOverdue", () => {
  it("compte les jours de retard", () => {
    expect(daysOverdue("2026-08-01", "2026-08-12")).toBe(11);
  });

  it("renvoie 0 avant l'échéance", () => {
    expect(daysOverdue("2026-09-01", "2026-08-12")).toBe(0);
    expect(daysOverdue("2026-08-12", "2026-08-12")).toBe(0);
  });
});

describe("isBefore", () => {
  it("compare deux dates", () => {
    expect(isBefore("2026-08-11", "2026-08-12")).toBe(true);
    expect(isBefore("2026-08-12", "2026-08-12")).toBe(false);
    expect(isBefore("2026-08-13", "2026-08-12")).toBe(false);
  });
});

describe("formatDate", () => {
  it("rend le format court JJ/MM/AAAA des tableaux", () => {
    expect(formatDate("2026-03-12")).toBe("12/03/2026");
    expect(formatDate("2026-12-01")).toBe("01/12/2026");
  });

  it("n'applique aucun décalage de fuseau", () => {
    // Une facture émise le 1er ne doit jamais s'afficher le 31 du mois précédent.
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("formatDateLong", () => {
  it("rend le format long utilisé sur le document", () => {
    expect(formatDateLong("2026-03-12").replace(/\s/gu, " ")).toBe("12 mars 2026");
  });
});

describe("todayIso", () => {
  it("renvoie une date ISO valide", () => {
    expect(isIsoDate(todayIso())).toBe(true);
  });

  it("utilise le calendrier local, sans décalage de fuseau", () => {
    // Une facture émise tard le soir doit porter la date locale du jour.
    const lateEvening = new Date(2026, 7, 12, 23, 30, 0);
    expect(todayIso(lateEvening)).toBe("2026-08-12");
  });
});
