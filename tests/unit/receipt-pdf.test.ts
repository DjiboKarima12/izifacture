import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { buildReceiptPdf, type ReceiptInput } from "@/lib/pdf/receipt";

const PT_PER_MM = 72 / 25.4;

function input(overrides: Partial<ReceiptInput> = {}): ReceiptInput {
  return {
    issuer: {
      name: "MaMa'S Food",
      legalName: null,
      email: null,
      phone: "+227 89 35 35 00",
      addressLine: null,
      city: "Niamey",
      country: "Niger",
      taxId: null,
      invoiceFooter: null,
      logoUrl: null,
    },
    client: {
      name: "Karima",
      email: null,
      phone: null,
      addressLine: null,
      city: null,
      country: null,
      taxId: null,
    },
    currency: "XOF",
    type: "invoice",
    number: "FAC-2026-0003",
    issueDate: "2026-09-07",
    dueDate: "2026-10-07",
    lines: [
      {
        description: "Poisson",
        quantity: 6,
        unitPrice: 500,
        taxRate: 18,
        lineSubtotal: 3000,
      },
    ],
    totals: {
      subtotal: 3000,
      discountTotal: 0,
      total: 3540,
      taxBreakdown: [{ rate: 18, tax: 540 }],
    },
    notes: "",
    amountPaid: 0,
    payments: [],
    ...overrides,
  };
}

async function pageSize(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();

  // Un ticket tient sur une page unique, par construction : la hauteur suit le
  // contenu. Plusieurs pages signifieraient que le calcul a dérapé.
  expect(pages).toHaveLength(1);

  return pages[0]!.getSize();
}

describe("buildReceiptPdf", () => {
  it("produit une page de 80 mm de large", async () => {
    const { width } = await pageSize(await buildReceiptPdf(input()));

    // C'est LE point du format : la largeur ne dépend d'aucun choix de
    // l'utilisateur dans une boîte d'impression.
    expect(width).toBeCloseTo(80 * PT_PER_MM, 1);
  });

  it("n'est jamais aussi haut qu'une page A4", async () => {
    const { height } = await pageSize(await buildReceiptPdf(input()));
    const a4Height = 297 * PT_PER_MM;

    expect(height).toBeLessThan(a4Height / 2);
  });

  it("grandit avec le nombre de lignes, au lieu de laisser du blanc", async () => {
    const court = await pageSize(await buildReceiptPdf(input()));
    const long = await pageSize(
      await buildReceiptPdf(
        input({
          lines: Array.from({ length: 12 }, (_, index) => ({
            description: `Article ${index + 1}`,
            quantity: 1,
            unitPrice: 500,
            taxRate: 18,
            lineSubtotal: 500,
          })),
        }),
      ),
    );

    expect(long.height).toBeGreaterThan(court.height);
    expect(long.width).toBeCloseTo(court.width, 5);
  });

  /**
   * `Intl.NumberFormat("fr-FR")` sépare les milliers par une espace fine
   * insécable (U+202F), que l'encodage WinAnsi de Courier ne connaît pas. Sans
   * substitution, la génération lève — et c'est le cas de TOUT montant à quatre
   * chiffres, donc de la quasi-totalité des factures réelles.
   */
  it("encode les montants à quatre chiffres et plus", async () => {
    await expect(
      buildReceiptPdf(
        input({
          lines: [
            {
              description: "Gros marché",
              quantity: 1,
              unitPrice: 1_250_000,
              taxRate: 18,
              lineSubtotal: 1_250_000,
            },
          ],
          totals: {
            subtotal: 1_250_000,
            discountTotal: 0,
            total: 1_475_000,
            taxBreakdown: [{ rate: 18, tax: 225_000 }],
          },
        }),
      ),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("ne casse pas sur un nom de client hors alphabet latin", async () => {
    const bytes = await buildReceiptPdf(
      input({
        client: {
          name: "Boutique 日本 🎉 Karima",
          email: null,
          phone: null,
          addressLine: null,
          city: null,
          country: null,
          taxId: null,
        },
      }),
    );

    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});

describe("logo de l'entreprise", () => {
  /** PNG 1×1 valide — assez pour que pdf-lib l'embarque réellement. */
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  function withLogo(logoUrl: string | null) {
    const base = input();
    return { ...base, issuer: { ...base.issuer, logoUrl } };
  }

  it("embarque le logo dans le fichier", async () => {
    const avec = await buildReceiptPdf(withLogo(PNG));
    const sans = await buildReceiptPdf(withLogo(null));

    // Une image embarquée alourdit le PDF : c'est la preuve la plus directe
    // qu'elle y est vraiment, sans avoir à rendre la page.
    expect(avec.byteLength).toBeGreaterThan(sans.byteLength);
  });

  it("reste sur une seule page de 80 mm avec un logo", async () => {
    const { width } = await pageSize(await buildReceiptPdf(withLogo(PNG)));
    expect(width).toBeCloseTo(80 * PT_PER_MM, 1);
  });

  /**
   * Le point qui compte vraiment. Le PDF est fabriqué par le serveur : si une
   * adresse fournie par l'utilisateur pouvait arriver jusqu'ici, télécharger
   * une facture ferait émettre à notre machine une requête vers la destination
   * de son choix. Le logo doit être ignoré, sans que rien ne soit chargé.
   */
  it("ignore une adresse distante au lieu d'aller la chercher", async () => {
    const distant = await buildReceiptPdf(withLogo("https://exemple.ne/logo.png"));
    const sans = await buildReceiptPdf(withLogo(null));

    expect(distant.byteLength).toBe(sans.byteLength);
  });

  it("ignore une image illisible sans faire échouer le téléchargement", async () => {
    await expect(
      buildReceiptPdf(withLogo("data:image/png;base64,AAAAAAAAAAAA")),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  /**
   * Le bloc de règlement s'imprime : c'est lui qui porte « reste à payer » sur
   * le reçu qu'on remet au client après un versement partiel.
   *
   * Mesuré par la HAUTEUR de la page, pas en cherchant du texte : les flux d'un
   * PDF sont compressés, et une recherche de chaîne y trouve des correspondances
   * fortuites — « 586 » ressort d'octets quelconques. La hauteur, elle, est la
   * somme des blocs réellement dessinés.
   */
  describe("bloc de règlement", () => {
    const lignes = async (input: ReceiptInput) => {
      const { height } = await pageSize(await buildReceiptPdf(input));
      return height;
    };

    it("ajoute des lignes quand un encaissement partiel existe", async () => {
      const sans = await lignes(input());
      const avec = await lignes(
        input({ amountPaid: 500, payments: [{ method: "cash", amount: 500 }] }),
      );

      // Moyen de paiement + reste à payer + mention en toutes lettres.
      expect(avec).toBeGreaterThan(sans);
    });

    it("ajoute deux lignes de plus quand il y a de la monnaie à rendre", async () => {
      const juste = await lignes(
        input({ amountPaid: 3540, payments: [{ method: "cash", amount: 3540 }] }),
      );
      const avecMonnaie = await lignes(
        input({ amountPaid: 3540, payments: [{ method: "cash", amount: 3540, tendered: 5000 }] }),
      );

      // « REÇU » et « MONNAIE RENDUE ».
      expect(avecMonnaie).toBeGreaterThan(juste);
    });

    it("n'imprime rien de tel sur un devis, qui n'appelle aucun paiement", async () => {
      const devis = await lignes(input({ type: "quote" }));
      const devisPaye = await lignes(
        input({ type: "quote", amountPaid: 500, payments: [{ method: "cash", amount: 500 }] }),
      );

      expect(devisPaye).toBe(devis);
    });
  });
});
