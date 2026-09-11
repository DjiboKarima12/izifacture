/**
 * Schémas Zod — source de vérité unique de la validation.
 *
 * Le MÊME schéma valide le formulaire côté client (react-hook-form) et l'entrée
 * côté serveur (Server Action / Route Handler). Un contrôle client seul n'est
 * qu'un confort d'affichage : la validation serveur est celle qui protège les
 * données. Aucune Server Action ne doit lire son entrée sans passer par ici.
 */

import { z } from "zod";

import { isValidLogo } from "@/lib/domain/logo";
import { CURRENCIES, MAX_AMOUNT, MIN_AMOUNT } from "@/lib/money";
import { isIsoDate } from "@/lib/dates";
import {
  DISCOUNT_TYPES,
  DOCUMENT_TYPES,
  MEMBER_ROLES,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
} from "@/lib/domain/types";

/* ------------------------------------------------------------ Primitives */

export const uuidSchema = z.string().uuid("Identifiant invalide");

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: "Date invalide (format attendu : AAAA-MM-JJ)" });

/** Montant : entier, en unités mineures. Aucun flottant n'est accepté. */
export const amountSchema = z
  .number()
  .int("Le montant doit être un nombre entier de francs")
  .min(0, "Le montant ne peut pas être négatif")
  .max(MAX_AMOUNT, "Montant trop élevé");

export const signedAmountSchema = z.number().int().min(MIN_AMOUNT).max(MAX_AMOUNT);

/** Quantité : jusqu'à 3 décimales, cohérent avec numeric(12,3) en base. */
export const quantitySchema = z
  .number()
  .positive("La quantité doit être supérieure à zéro")
  .max(1_000_000, "Quantité trop élevée")
  .refine((value) => Number.isInteger(value * 1000), {
    message: "La quantité accepte au maximum 3 décimales",
  });

export const taxRateSchema = z
  .number()
  .min(0, "Le taux de TVA ne peut pas être négatif")
  .max(100, "Le taux de TVA ne peut pas dépasser 100 %")
  .refine((value) => Number.isInteger(value * 100), {
    message: "Le taux accepte au maximum 2 décimales",
  });

export const currencySchema = z.enum(CURRENCIES);

/** Téléphone international ou local (les formats varient trop d'un pays à l'autre). */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Numéro trop court")
  .max(24, "Numéro trop long")
  .regex(/^[+]?[\d\s().-]+$/, "Numéro de téléphone invalide");

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/* --------------------------------------------------------------- Client */

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom du client est requis").max(200),
  email: emailSchema.nullable().optional().or(z.literal("").transform(() => null)),
  phone: phoneSchema.nullable().optional().or(z.literal("").transform(() => null)),
  addressLine: optionalText(300),
  city: optionalText(120),
  country: optionalText(120),
  taxId: optionalText(60),
  notes: optionalText(2000),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

/* ------------------------------------------------------------- Produits */

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom du produit est requis").max(200),
  unitPrice: amountSchema,
  taxRate: taxRateSchema,
  /**
   * Un code-barres est une suite de caractères imprimables sans espace. On
   * rogne les blancs : les lecteurs en ajoutent souvent un avant l'entrée, et
   * un code invisible mais différent ne serait jamais retrouvé au scan.
   */
  barcode: z
    .string()
    .trim()
    .max(64)
    .regex(/^[!-~]*$/, "Code-barres invalide")
    .nullable()
    .optional()
    /**
     * La conversion vient APRÈS la validation, et non dans un `.or()`.
     *
     * La regex accepte la chaîne vide, donc `""` satisfaisait la première
     * branche et n'atteignait jamais la conversion : le produit partait en base
     * avec un code vide au lieu de `null`, et l'index unique sur (org, code)
     * aurait refusé le deuxième produit sans code-barres.
     */
    .transform((value) => (value == null || value === "" ? null : value)),
  unit: optionalText(20),
  notes: optionalText(1000),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/* -------------------------------------------------------------- Remises */

export const discountSchema = z
  .object({
    type: z.enum(DISCOUNT_TYPES),
    value: z.number().min(0),
  })
  .refine((discount) => (discount.type === "percent" ? discount.value <= 100 : true), {
    message: "Une remise en pourcentage ne peut pas dépasser 100 %",
    path: ["value"],
  })
  .refine((discount) => (discount.type === "amount" ? Number.isInteger(discount.value) : true), {
    message: "Une remise en montant doit être un nombre entier de francs",
    path: ["value"],
  })
  .nullable();

/* --------------------------------------------------------- Lignes / facture */

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "La désignation est requise").max(500),
  quantity: quantitySchema,
  unitPrice: amountSchema,
  taxRate: taxRateSchema,
  discount: discountSchema.optional().default(null),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const invoiceInputSchema = z
  .object({
    /**
     * Facultatif : une vente au comptoir n'a pas de client nommé.
     *
     * La chaîne vide devient `null` plutôt que d'être refusée — c'est ce qu'un
     * champ de formulaire laissé vide envoie, et le serveur doit accepter
     * l'entrée telle que le navigateur la produit.
     */
    clientId: uuidSchema
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    type: z.enum(DOCUMENT_TYPES).default("invoice"),
    issueDate: isoDateSchema,
    dueDate: isoDateSchema,
    currency: currencySchema,
    notes: optionalText(2000),
    terms: optionalText(2000),
    items: z
      .array(invoiceItemInputSchema)
      .min(1, "Une facture doit comporter au moins une ligne")
      .max(200, "Trop de lignes (200 maximum)"),
  })
  .refine((invoice) => invoice.dueDate >= invoice.issueDate, {
    message: "L'échéance ne peut pas précéder la date d'émission",
    path: ["dueDate"],
  });

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

/* ------------------------------------------------------------ Paiements */

export const paymentInputSchema = z
  .object({
    invoiceId: uuidSchema,
    amount: amountSchema.refine((value) => value > 0, {
      message: "Le montant encaissé doit être supérieur à zéro",
    }),
    paidAt: isoDateSchema,
    method: z.enum(PAYMENT_METHODS),
    /**
     * Montant remis par le client. Facultatif : il ne se saisit qu'en espèces,
     * et rien n'oblige à le noter.
     */
    tendered: amountSchema.nullable().optional(),
    reference: optionalText(120),
    note: optionalText(1000),
  })
  .refine((input) => input.tendered == null || input.tendered >= input.amount, {
    message: "Le montant reçu ne peut pas être inférieur au montant encaissé",
    path: ["tendered"],
  });

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/**
 * Règlement encaissé au moment même de l'émission — la vente au comptoir.
 *
 * Sa PRÉSENCE vaut « payée » : pas de booléen `paid` à tenir cohérent avec le
 * reste. Absent, la facture part impayée.
 *
 * Aucun montant n'y figure. Ce qui est encaissé, c'est le total du document, et
 * ce total est recalculé par le serveur depuis les lignes — le laisser passer
 * par le navigateur rouvrirait précisément ce que la règle 2 interdit.
 */
export const invoiceSettlementSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  /**
   * Ce que le client a DONNÉ — un seul chiffre, dont tout se déduit : ce qui est
   * encaissé, la monnaie à rendre, le reste dû.
   *
   * Peut être inférieur au total : c'est un acompte, pas une erreur. Peut lui
   * être supérieur en espèces : c'est un billet, et la différence se rend.
   *
   * `null` vaut « le compte juste » — le cas courant, qui ne mérite pas qu'on
   * retape le total. Le total, lui, ne transite jamais par le navigateur : le
   * serveur le recalcule depuis les lignes avant de borner l'encaissement.
   */
  received: amountSchema.nullable().optional(),
});

export type InvoiceSettlementInput = z.infer<typeof invoiceSettlementSchema>;

/* --------------------------------------------------------- Organisation */

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'entreprise est requis").max(200),
  legalName: optionalText(200),
  email: emailSchema.nullable().optional().or(z.literal("").transform(() => null)),
  phone: phoneSchema.nullable().optional().or(z.literal("").transform(() => null)),
  addressLine: optionalText(300),
  city: optionalText(120),
  country: z.string().trim().min(2).max(120),
  taxId: optionalText(60),
  currency: currencySchema,
  defaultTaxRate: taxRateSchema,
  defaultPaymentTerms: z.number().int().min(0).max(365),
  invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9-]{1,8}$/, "1 à 8 caractères (A-Z, 0-9, -)"),
  quotePrefix: z.string().trim().regex(/^[A-Za-z0-9-]{1,8}$/, "1 à 8 caractères (A-Z, 0-9, -)"),
  creditNotePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,8}$/, "1 à 8 caractères (A-Z, 0-9, -)"),
  invoiceFooter: optionalText(1000),
  /**
   * Image encodée dans la valeur, jamais une adresse : le PDF est fabriqué par
   * le serveur, et une URL fournie par l'utilisateur lui ferait émettre une
   * requête vers la destination de son choix (SSRF). Voir `lib/domain/logo`.
   */
  logoUrl: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isValidLogo(value), {
      message: "Logo invalide : image PNG, JPEG ou WebP de moins de 48 Ko.",
    }),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBER_ROLES).exclude(["owner"]),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/* -------------------------------------------------------------- Récurrence */

export const recurringScheduleInputSchema = z
  .object({
    clientId: uuidSchema,
    label: z.string().trim().min(2).max(200),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(12),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    paymentTerms: z.number().int().min(0).max(365),
    template: z.array(invoiceItemInputSchema).min(1, "Au moins une ligne est requise"),
  })
  .refine((schedule) => !schedule.endDate || schedule.endDate >= schedule.startDate, {
    message: "La date de fin ne peut pas précéder la date de début",
    path: ["endDate"],
  });

export type RecurringScheduleInput = z.infer<typeof recurringScheduleInputSchema>;
