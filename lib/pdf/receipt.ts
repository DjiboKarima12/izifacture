import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { code39Runs, code39Width } from "@/lib/barcode/code39";
import { logoBytes, parseLogoDataUri } from "@/lib/domain/logo";
import { formatAmount, formatQuantity, type Currency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  changeGiven,
  PAYMENT_METHOD_LABELS,
  paymentSummary,
  showsSettlement,
} from "@/lib/payments";
import type { DocumentType, IsoDate, PaymentMethod } from "@/lib/domain/types";

/**
 * Génération du reçu en PDF, au format exact du rouleau 80 mm.
 *
 * POURQUOI PAS L'IMPRESSION DU NAVIGATEUR — `window.print()` passe forcément par
 * la boîte de dialogue, où le format papier est un choix de l'utilisateur que le
 * navigateur mémorise. Une règle `@page` PROPOSE une taille ; elle ne l'impose
 * pas. Tant qu'on passe par là, « A4 » reste à un clic de distance, et le
 * document ressort centré au milieu d'une feuille vide aux trois quarts.
 *
 * Ici, la page EST le ticket : 80 mm de large, et une hauteur calculée sur le
 * contenu réel. Aucun dialogue, aucun format à choisir, le même fichier pour
 * tout le monde.
 *
 * Courier plutôt qu'une police embarquée : c'est une des quatorze polices que
 * tout lecteur PDF possède déjà — rien à télécharger, un fichier de quelques
 * kilo-octets — et c'est une chasse fixe, ce qui aligne les montants sans avoir
 * à mesurer quoi que ce soit.
 */

const PT_PER_MM = 72 / 25.4;

const PAGE_WIDTH_MM = 80;
const MARGIN_MM = 5;
const FONT_SIZE = 8;
const TITLE_SIZE = 9;
const LINE_HEIGHT = 10.5;
const BLOCK_GAP = 7;

/** Hauteur des barres du code-barres, en points. */
const BARCODE_HEIGHT = 28;

const PAGE_WIDTH = PAGE_WIDTH_MM * PT_PER_MM;
const MARGIN = MARGIN_MM * PT_PER_MM;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Courier avance de 0,6 em par caractère, quelle que soit la lettre. */
const CHAR_WIDTH = FONT_SIZE * 0.6;
const COLUMNS = Math.floor(CONTENT_WIDTH / CHAR_WIDTH);

export type ReceiptParty = {
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
};

export type ReceiptIssuer = ReceiptParty & {
  legalName: string | null;
  invoiceFooter: string | null;
  /** Data URI validée par `lib/domain/logo` — jamais une adresse distante. */
  logoUrl: string | null;
};

export type ReceiptLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineSubtotal: number;
};

/** Un encaissement tel qu'il s'imprime : le moyen, ce qu'il règle, ce qui a été tendu. */
export type ReceiptPayment = {
  method: PaymentMethod;
  amount: number;
  /** Montant remis par le client, espèces uniquement. `null` ailleurs. */
  tendered?: number | null;
};

export type ReceiptTotals = {
  subtotal: number;
  discountTotal: number;
  total: number;
  taxBreakdown: Array<{ rate: number; tax: number }>;
};

export type ReceiptInput = {
  issuer: ReceiptIssuer;
  client: ReceiptParty | null;
  currency: Currency;
  type: DocumentType;
  number: string;
  issueDate: IsoDate;
  dueDate: IsoDate;
  lines: ReceiptLine[];
  totals: ReceiptTotals;
  notes: string;
  /**
   * Encaissé cumulé, tel qu'il est STOCKÉ sur la facture — pas la somme de
   * `payments`. Un trigger Postgres le maintient ; le recalculer ici ferait
   * dépendre le ticket de ce que l'appelant a bien voulu charger.
   */
  amountPaid: number;
  /** Le détail des règlements. Vide sur un brouillon, qui n'en a aucun. */
  payments: ReceiptPayment[];
};

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  invoice: "FACTURE",
  quote: "DEVIS",
  credit_note: "AVOIR",
};

/**
 * Ramène le texte à ce que Courier sait écrire (WinAnsi, le latin étendu).
 * Deux pièges concrets :
 *
 *  - `Intl.NumberFormat("fr-FR")` sépare les milliers par une ESPACE FINE
 *    INSÉCABLE (U+202F), absente de WinAnsi : sans cette substitution, tout
 *    montant à quatre chiffres ferait échouer la génération ;
 *  - un nom de client peut contenir n'importe quoi. L'inconnu est retiré plutôt
 *    que de renvoyer une erreur à la place du fichier.
 */
const SUBSTITUTIONS: Record<string, string> = {
  " ": " ",
  " ": " ",
  "−": "-",
  "–": "-",
  "—": "-",
  "…": "...",
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
};

function pdfText(value: string): string {
  return value
    .replace(/[  −–—…’‘“”]/g, (character) => SUBSTITUTIONS[character] ?? " ")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "");
}

/** Découpe sur les espaces, et tranche dans le mot s'il dépasse à lui seul. */
function wrap(text: string, columns: number): string[] {
  const out: string[] = [];

  for (const paragraph of text.split("\n")) {
    let current = "";

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= columns) {
        current = `${current} ${word}`;
      } else {
        out.push(current);
        current = word;
      }

      while (current.length > columns) {
        out.push(current.slice(0, columns));
        current = current.slice(columns);
      }
    }

    out.push(current);
  }

  return out.length > 0 ? out : [""];
}

/**
 * Un bloc à dessiner et la hauteur qu'il occupe.
 *
 * On construit d'abord la liste complète, ce qui donne la hauteur totale, PUIS
 * on crée la page à cette hauteur. C'est l'inverse d'une impression papier, où
 * le format est connu d'avance et le contenu doit s'y plier.
 */
type Op = { height: number; draw: (page: PDFPage, top: number) => void };

export async function buildReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);

  const ops: Op[] = [];

  const write = (
    text: string,
    options: { font?: PDFFont; size?: number; align?: "left" | "center" } = {},
  ): Op => {
    const font = options.font ?? regular;
    const size = options.size ?? FONT_SIZE;
    const value = pdfText(text);

    return {
      height: LINE_HEIGHT,
      draw: (page, top) => {
        const width = font.widthOfTextAtSize(value, size);
        const x = options.align === "center" ? MARGIN + (CONTENT_WIDTH - width) / 2 : MARGIN;
        page.drawText(value, { x, y: top - size, size, font });
      },
    };
  };

  /** Libellé à gauche, valeur calée à droite — la ligne type du ticket. */
  const row = (
    label: string,
    value: string,
    options: { font?: PDFFont; indent?: number } = {},
  ): Op => {
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const left = pdfText(label);
    const right = pdfText(value);

    return {
      height: LINE_HEIGHT,
      draw: (page, top) => {
        const y = top - FONT_SIZE;
        page.drawText(left, { x: MARGIN + indent, y, size: FONT_SIZE, font });
        const width = font.widthOfTextAtSize(right, FONT_SIZE);
        page.drawText(right, { x: MARGIN + CONTENT_WIDTH - width, y, size: FONT_SIZE, font });
      },
    };
  };

  const separator = (): Op => ({
    height: BLOCK_GAP * 2,
    draw: (page, top) => {
      page.drawLine({
        start: { x: MARGIN, y: top - BLOCK_GAP },
        end: { x: MARGIN + CONTENT_WIDTH, y: top - BLOCK_GAP },
        thickness: 0.5,
        dashArray: [2, 2],
      });
    },
  });

  const gap = (height: number = BLOCK_GAP): Op => ({ height, draw: () => {} });

  // ------------------------------------------------------------- En-tête
  const issuerName = pdfText((input.issuer.legalName ?? input.issuer.name).toUpperCase());
  // Lettres espacées, comme l'enseigne en haut d'un ticket de caisse.
  const spaced = issuerName.split("").join(" ").slice(0, COLUMNS);

  /**
   * Logo, s'il y en a un — posé À DROITE, le nom de l'entreprise restant à
   * gauche. Les deux se partagent la largeur au lieu de s'empiler : sur 80 mm,
   * l'un au-dessus de l'autre mangerait le tiers du ticket avant la première
   * ligne.
   *
   * WebP est exclu ici : `pdf-lib` n'embarque que le PNG et le JPEG. Le fichier
   * reste valide en base, il ne sort simplement pas sur le PDF — l'entreprise
   * retrouve son enseigne en toutes lettres, ce qui vaut mieux qu'un
   * téléchargement en échec.
   */
  const logo = parseLogoDataUri(input.issuer.logoUrl);
  const logoImage =
    logo && logo.mimeType !== "image/webp"
      ? await (
          logo.mimeType === "image/png"
            ? pdf.embedPng(logoBytes(input.issuer.logoUrl)!)
            : pdf.embedJpg(logoBytes(input.issuer.logoUrl)!)
        ).catch(() => null)
      : null;

  /** Le bandeau noir à texte réservé, dessiné à l'abscisse demandée. */
  const banner = (align: "left" | "center"): Op => ({
    height: LINE_HEIGHT + 8,
    draw: (page, top) => {
      const width = bold.widthOfTextAtSize(spaced, TITLE_SIZE);
      const boxWidth = Math.min(width + 12, CONTENT_WIDTH);
      const boxHeight = LINE_HEIGHT + 4;
      const x = align === "center" ? MARGIN + (CONTENT_WIDTH - boxWidth) / 2 : MARGIN;

      page.drawRectangle({
        x,
        y: top - boxHeight,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0, 0, 0),
      });
      page.drawText(spaced, {
        x: x + (boxWidth - width) / 2,
        y: top - boxHeight + 5,
        size: TITLE_SIZE,
        font: bold,
        color: rgb(1, 1, 1),
      });
    },
  });

  const issuerLines = [
    input.issuer.addressLine,
    [input.issuer.city, input.issuer.country].filter(Boolean).join(", ") || null,
    input.issuer.phone,
    input.issuer.taxId ? `NIF ${input.issuer.taxId}` : null,
  ].filter((value): value is string => Boolean(value));

  if (logoImage) {
    // Le logo occupe au plus 38 % de la largeur : au-delà, il ne reste plus
    // assez de place au nom, qui passerait à la ligne.
    const scale = Math.min((CONTENT_WIDTH * 0.38) / logoImage.width, 40 / logoImage.height, 1);
    const width = logoImage.width * scale;
    const height = logoImage.height * scale;

    const nameBlock = banner("left");
    // Le bloc de gauche s'écrit sur autant de lignes qu'il a de coordonnées ;
    // la hauteur retenue est la plus grande des deux colonnes.
    const textHeight = nameBlock.height + 4 + issuerLines.length * LINE_HEIGHT;

    ops.push({
      height: Math.max(textHeight, height),
      draw: (page, top) => {
        nameBlock.draw(page, top);

        let cursor = top - nameBlock.height - 4;
        for (const line of issuerLines) {
          // Tronqué plutôt que replié : la colonne de gauche est étroite, et
          // une adresse qui déborderait passerait sous le logo.
          const value = pdfText(line.toUpperCase()).slice(0, Math.floor(COLUMNS * 0.55));
          page.drawText(value, {
            x: MARGIN,
            y: cursor - FONT_SIZE,
            size: FONT_SIZE,
            font: regular,
          });
          cursor -= LINE_HEIGHT;
        }

        page.drawImage(logoImage, {
          x: MARGIN + CONTENT_WIDTH - width,
          y: top - height,
          width,
          height,
        });
      },
    });
  } else {
    ops.push(banner("center"));
    ops.push(gap(4));

    for (const line of issuerLines) {
      for (const chunk of wrap(line.toUpperCase(), COLUMNS)) {
        ops.push(write(chunk, { align: "center" }));
      }
    }
  }

  // ---------------------------------------------------------- Références
  ops.push(separator());
  ops.push(row(DOCUMENT_TITLES[input.type], input.number, { font: bold }));
  ops.push(row("DATE", formatDate(input.issueDate)));
  ops.push(row(input.type === "quote" ? "VALIDITE" : "ECHEANCE", formatDate(input.dueDate)));
  // Pas de ligne du tout sans client : une vente au comptoir n'a pas de
  // destinataire, et « CLIENT - » laisserait croire qu'on a perdu le nom.
  if (input.client) {
    ops.push(row("CLIENT", input.client.name.toUpperCase()));
  }

  // -------------------------------------------------------------- Lignes
  ops.push(separator());

  if (input.lines.length === 0) {
    ops.push(write("AUCUNE LIGNE", { align: "center" }));
  } else {
    input.lines.forEach((line, index) => {
      if (index > 0) ops.push(gap(3));

      for (const chunk of wrap((line.description || "-").toUpperCase(), COLUMNS)) {
        ops.push(write(chunk));
      }

      const unit = formatAmount(line.unitPrice, input.currency, { withSymbol: false });
      const detail =
        `${formatQuantity(line.quantity)} x ${unit}` +
        (line.taxRate > 0 ? ` TVA ${line.taxRate}%` : "");

      ops.push(
        row(detail, formatAmount(line.lineSubtotal, input.currency, { withSymbol: false }), {
          indent: CHAR_WIDTH * 2,
        }),
      );
    });
  }

  // -------------------------------------------------------------- Totaux
  ops.push(separator());

  // Bloc collé à droite, comme sur un reçu de caisse.
  const totalsIndent = CONTENT_WIDTH * 0.28;

  ops.push(
    row("SOUS-TOTAL", formatAmount(input.totals.subtotal, input.currency, { withSymbol: false }), {
      indent: totalsIndent,
    }),
  );

  if (input.totals.discountTotal > 0) {
    ops.push(
      row(
        "REMISE",
        `- ${formatAmount(input.totals.discountTotal, input.currency, { withSymbol: false })}`,
        { indent: totalsIndent },
      ),
    );
  }

  for (const bucket of input.totals.taxBreakdown.filter((entry) => entry.rate > 0)) {
    ops.push(
      row(`TVA ${bucket.rate}%`, formatAmount(bucket.tax, input.currency, { withSymbol: false }), {
        indent: totalsIndent,
      }),
    );
  }

  ops.push(gap(3));
  ops.push({
    height: 4,
    draw: (page, top) => {
      page.drawLine({
        start: { x: MARGIN + totalsIndent, y: top },
        end: { x: MARGIN + CONTENT_WIDTH, y: top },
        thickness: 0.7,
      });
    },
  });
  ops.push(
    row("TOTAL", formatAmount(input.totals.total, input.currency), {
      font: bold,
      indent: totalsIndent,
    }),
  );

  // ------------------------------------------------------- Règlement
  /**
   * Ce bloc répond à la question que le client se pose en lisant le total :
   * est-ce que je dois encore quelque chose ?
   *
   * Même règle que l'aperçu, via `lib/payments` — les deux partagent la
   * fonction plutôt que de la réécrire chacun. Rien sur un devis, sur un avoir
   * ni sur un total nul : `showsSettlement` en explique la raison.
   */
  const settlement = showsSettlement(input.type, input.totals.total)
    ? paymentSummary(input.totals.total, input.amountPaid)
    : null;

  if (settlement) {
    ops.push(separator());

    for (const payment of input.payments) {
      ops.push(
        row(
          PAYMENT_METHOD_LABELS[payment.method].toUpperCase(),
          formatAmount(payment.amount, input.currency, { withSymbol: false }),
        ),
      );

      // `null` dès que la question ne se pose pas : pas d'espèces, ou aucun
      // montant remis saisi. Zéro s'imprime — « compte juste » est justement ce
      // que le client vient vérifier sur le ticket.
      const change = changeGiven(payment.amount, payment.tendered);
      if (change !== null) {
        ops.push(
          row("REÇU", formatAmount(payment.tendered ?? 0, input.currency, { withSymbol: false })),
        );
        ops.push(
          row("MONNAIE RENDUE", formatAmount(change, input.currency, { withSymbol: false })),
        );
      }
    }

    // Le cumul n'a d'intérêt que face à plusieurs versements.
    if (input.payments.length > 1) {
      ops.push(
        row("TOTAL PAYÉ", formatAmount(settlement.paid, input.currency, { withSymbol: false })),
      );
    }

    // Un « reste à payer : 0 » sur une facture soldée est une ligne pour rien.
    if (settlement.remaining > 0) {
      ops.push(
        row("RESTE À PAYER", formatAmount(settlement.remaining, input.currency), { font: bold }),
      );
    }

    ops.push(gap(3));
    // La mention en toutes lettres : c'est ce qu'on cherche d'un coup d'œil.
    ops.push(write(settlement.label.toUpperCase(), { font: bold, align: "center" }));
  }

  // -------------------------------------------- Code-barres et légende
  /**
   * Le numéro du document, scannable, et sous les barres sa légende.
   *
   * LA LÉGENDE EST LA NOTE quand il y en a une, le numéro sinon — même règle
   * que l'aperçu, qui doit montrer le même ticket. La ligne sous un code-barres
   * sert normalement de recours quand le scan échoue, et on y renonce : le
   * numéro reste lisible en tête du ticket, la place du bas revient au message
   * adressé au client.
   *
   * Un brouillon n'a pas encore de numéro : rien à encoder, donc pas de barres
   * — mieux vaut leur absence qu'un code renvoyant vers un document sans
   * identité. La note, elle, reste imprimée.
   */
  const note = input.notes.trim();
  const numbered = Boolean(input.number.trim()) && !/^BROUILLON$/i.test(input.number);

  // La note garde sa casse : une phrase entière en capitales ne se lit plus.
  const caption = () => wrap(note, COLUMNS).map((chunk) => write(chunk, { align: "center" }));

  if (numbered) {
    ops.push(gap(10));

    const runs = code39Runs(input.number);
    const moduleWidth = CONTENT_WIDTH / code39Width(input.number);

    ops.push({
      height: BARCODE_HEIGHT,
      draw: (page, top) => {
        let x = MARGIN;
        for (const run of runs) {
          const width = run.width * moduleWidth;
          if (run.dark) {
            page.drawRectangle({
              x,
              y: top - BARCODE_HEIGHT,
              width,
              height: BARCODE_HEIGHT,
              color: rgb(0, 0, 0),
            });
          }
          x += width;
        }
      },
    });

    ops.push(gap(3));
    ops.push(...(note ? caption() : [write(input.number, { align: "center" })]));
  } else if (note) {
    ops.push(separator());
    ops.push(...caption());
  }

  // -------------------------------------------------------------- Pied
  if (input.issuer.invoiceFooter?.trim()) {
    ops.push(gap(4));
    for (const chunk of wrap(input.issuer.invoiceFooter.trim().toUpperCase(), COLUMNS)) {
      ops.push(write(chunk, { align: "center" }));
    }
  }

  // La hauteur de la page N'EST PAS un format : c'est la somme du contenu.
  const height = ops.reduce((sum, op) => sum + op.height, 0) + MARGIN * 2;
  const page = pdf.addPage([PAGE_WIDTH, height]);

  let cursor = height - MARGIN;
  for (const op of ops) {
    op.draw(page, cursor);
    cursor -= op.height;
  }

  return pdf.save();
}
