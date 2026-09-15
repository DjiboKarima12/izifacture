/**
 * Règles d'ajout d'un article scanné à une facture en cours de saisie.
 *
 * Logique pure, hors de l'interface : c'est ce qui se produit quand la douchette
 * bipe, et ça doit être vérifiable sans navigateur.
 *
 * Les montants restent des CHAÎNES ici : la saisie n'est convertie qu'au calcul
 * des totaux. Une conversion prématurée obligerait à reconvertir dans l'autre
 * sens pour réafficher le champ, et un aller-retour sur un montant finit
 * toujours par perdre quelque chose.
 */

/** Une ligne de facture telle que le formulaire la manipule. */
export type ScannableLine = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  /**
   * Article du catalogue dont la ligne provient, s'il y en a un.
   *
   * Sert UNIQUEMENT à reconnaître un article déjà scanné. Il n'est pas envoyé
   * au serveur : la ligne porte le nom et le prix recopiés au moment de la
   * vente, et c'est cette copie qui fait foi. Changer un prix au catalogue ne
   * doit jamais réécrire une facture.
   */
  productId?: string;
};

export type ScannedProduct = {
  id: string;
  name: string;
  unitPrice: number;
  taxRate: number;
};

/** Quantité d'une ligne, tolérante à la virgule décimale et aux saisies vides. */
function quantityOf(line: ScannableLine): number {
  const valeur = Number(line.quantity.replace(",", "."));
  return Number.isFinite(valeur) && valeur > 0 ? valeur : 0;
}

/** Une ligne que l'utilisateur n'a pas commencé à remplir. */
function isBlank(line: ScannableLine): boolean {
  return line.description.trim() === "" && line.unitPrice.trim() === "";
}

/**
 * Ajoute l'article scanné à la liste des lignes.
 *
 * Trois cas, dans cet ordre :
 *
 * 1. L'article est DÉJÀ sur la vente — sa quantité augmente de un. Scanner trois
 *    fois la même boîte doit donner « 3 × boîte », pas trois lignes identiques :
 *    c'est ce que fait une caisse, et c'est ce qui se lit sur le ticket.
 * 2. La facture ne contient qu'une ligne VIERGE — celle que le formulaire ouvre
 *    par défaut. On la remplit au lieu d'en ajouter une, sinon une ligne fantôme
 *    reste en tête et bloque l'émission faute de désignation.
 * 3. Sinon, une ligne de plus.
 */
export function addScannedProduct(
  lines: ScannableLine[],
  product: ScannedProduct,
  nextId: () => string,
): ScannableLine[] {
  const existante = lines.find((line) => line.productId === product.id);
  if (existante) {
    return lines.map((line) =>
      line.id === existante.id ? { ...line, quantity: String(quantityOf(line) + 1) } : line,
    );
  }

  const remplie: ScannableLine = {
    id: nextId(),
    description: product.name,
    quantity: "1",
    unitPrice: String(product.unitPrice),
    taxRate: String(product.taxRate),
    productId: product.id,
  };

  if (lines.length === 1 && isBlank(lines[0]!)) {
    // On garde l'identifiant de la ligne existante : React réutilise la même
    // rangée au lieu de la démonter, donc le focus et la position ne sautent pas.
    return [{ ...remplie, id: lines[0]!.id }];
  }

  return [...lines, remplie];
}
