import { describe, expect, it } from "vitest";

import { organizationSettingsSchema, clientInputSchema } from "@/lib/domain/schemas";

/**
 * Ces tests reproduisent la charge EXACTE envoyée par les formulaires.
 * Un schéma trop strict rend un bouton « Enregistrer » silencieusement
 * inopérant : c'est le mode d'échec qu'on verrouille ici.
 */
const settingsPayload = {
  name: "Atelier Sahel",
  legalName: "Atelier Sahel SARL",
  email: "contact@atelier-sahel.ne",
  phone: "+227 90 12 34 56",
  addressLine: "12 avenue de l'Indépendance, Plateau",
  city: "Niamey",
  country: "Niger",
  taxId: "NIF 4512345/P",
  currency: "XOF" as const,
  defaultTaxRate: 19,
  defaultPaymentTerms: 30,
  invoicePrefix: "FAC",
  quotePrefix: "DEV",
  creditNotePrefix: "AV",
  invoiceFooter: "Merci de votre confiance.",
};

describe("organizationSettingsSchema", () => {
  it("accepte le formulaire de paramètres complet", () => {
    expect(organizationSettingsSchema.safeParse(settingsPayload).success).toBe(true);
  });

  it("accepte les champs facultatifs vides", () => {
    const result = organizationSettingsSchema.safeParse({
      ...settingsPayload,
      legalName: "",
      email: "",
      phone: "",
      addressLine: "",
      city: "",
      taxId: "",
      invoiceFooter: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Une chaîne vide devient `null`, pas une chaîne vide en base.
      expect(result.data.legalName).toBeNull();
      expect(result.data.email).toBeNull();
    }
  });

  it("accepte un taux de TVA à décimale", () => {
    expect(
      organizationSettingsSchema.safeParse({ ...settingsPayload, defaultTaxRate: 18.5 }).success,
    ).toBe(true);
  });

  it("refuse ce qui casserait une facture", () => {
    const rejects = (patch: Record<string, unknown>) =>
      organizationSettingsSchema.safeParse({ ...settingsPayload, ...patch }).success;

    expect(rejects({ name: "A" })).toBe(false); // nom trop court
    expect(rejects({ country: "" })).toBe(false); // pays obligatoire
    expect(rejects({ defaultTaxRate: 120 })).toBe(false); // TVA hors bornes
    expect(rejects({ defaultPaymentTerms: -1 })).toBe(false); // délai négatif
    expect(rejects({ defaultPaymentTerms: 12.5 })).toBe(false); // délai non entier
    expect(rejects({ invoicePrefix: "TROPLONGPREFIXE" })).toBe(false);
    expect(rejects({ invoicePrefix: "FAC/2026" })).toBe(false); // caractère interdit
    expect(rejects({ email: "pas-un-email" })).toBe(false);
  });

  it("rejette un nombre transmis sous forme de chaîne", () => {
    // Le formulaire doit convertir avant l'envoi : cette garantie est ce qui
    // rend l'échec visible en développement plutôt qu'en production.
    expect(
      organizationSettingsSchema.safeParse({ ...settingsPayload, defaultTaxRate: "19" }).success,
    ).toBe(false);
  });
});

describe("clientInputSchema", () => {
  it("accepte le formulaire client complet", () => {
    expect(
      clientInputSchema.safeParse({
        name: "Niger Telecoms",
        email: "contact@nigertelecoms.ne",
        phone: "+227 20 73 30 00",
        addressLine: "Avenue du Zarmaganda",
        city: "Niamey",
        country: "Niger",
        taxId: "NIF 1234567/P",
        notes: "",
      }).success,
    ).toBe(true);
  });

  it("accepte un client réduit à son nom", () => {
    const result = clientInputSchema.safeParse({
      name: "Client de passage",
      email: "",
      phone: "",
      addressLine: "",
      city: "",
      country: "",
      taxId: "",
      notes: "",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeNull();
  });

  it("refuse un nom trop court", () => {
    expect(clientInputSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});
