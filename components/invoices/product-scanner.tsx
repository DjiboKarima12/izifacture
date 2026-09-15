"use client";

import * as React from "react";
import { Barcode, CircleAlert, CircleCheck } from "lucide-react";

import { bareInputClasses, FloatingField } from "@/components/ui/input";
import { findProductByBarcode } from "@/lib/actions/products";
import { formatAmount, type Currency } from "@/lib/money";
import type { Product } from "@/lib/domain/types";

/**
 * Champ de scan d'articles.
 *
 * POURQUOI UN SIMPLE CHAMP TEXTE — une douchette USB se comporte comme un
 * clavier : elle « tape » le code très vite puis envoie Entrée. Il n'y a donc
 * ni pilote, ni permission, ni caméra à demander. C'est aussi ce qui la rend
 * fiable dans une boutique, là où l'appareil photo échoue sur un code froissé
 * ou dans la pénombre.
 *
 * Le champ REPREND LE FOCUS après chaque scan : au comptoir on enchaîne cinq
 * articles sans toucher à l'écran. S'il fallait recliquer entre deux, la
 * douchette ne servirait à rien.
 */
export function ProductScanner({
  currency,
  onScanned,
  disabled,
}: {
  currency: Currency;
  /** Appelé avec l'article trouvé ; à charge de l'appelant d'ajouter la ligne. */
  onScanned: (product: Product) => void;
  disabled?: boolean;
}) {
  const champ = React.useRef<HTMLInputElement>(null);
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [resultat, setResultat] = React.useState<
    { type: "trouve"; product: Product } | { type: "inconnu"; code: string } | null
  >(null);

  const scanner = (saisi: string) => {
    const valeur = saisi.trim();
    if (!valeur || pending) return;

    setCode("");
    startTransition(async () => {
      const reponse = await findProductByBarcode(valeur);

      if (!reponse.ok || !reponse.data.product) {
        setResultat({ type: "inconnu", code: valeur });
      } else {
        setResultat({ type: "trouve", product: reponse.data.product });
        onScanned(reponse.data.product);
      }

      champ.current?.focus();
    });
  };

  return (
    <div className="space-y-2">
      <FloatingField label="Scanner un article" htmlFor="scan" icon={Barcode}>
        <input
          id="scan"
          ref={champ}
          value={code}
          disabled={disabled}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            /**
             * La douchette envoie Entrée à la fin du code. Sans cette
             * interception, cette touche validerait le formulaire et créerait
             * la facture au premier article scanné.
             */
            event.preventDefault();
            scanner(code);
          }}
          placeholder="Douchette ou saisie du code, puis Entrée"
          className={`${bareInputClasses} tabular`}
          autoComplete="off"
        />
      </FloatingField>

      {/*
        Le retour doit être lisible sans quitter la douchette des yeux : on
        annonce ce qui vient d'entrer, pas seulement que « ça a marché ».
        `aria-live` le fait aussi énoncer par un lecteur d'écran.
      */}
      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-xs">
        {pending ? <span className="text-muted-foreground">Recherche…</span> : null}

        {!pending && resultat?.type === "trouve" ? (
          <span className="inline-flex items-center gap-1.5 text-status-paid">
            <CircleCheck className="size-3.5 shrink-0" aria-hidden />
            {resultat.product.name} · {formatAmount(resultat.product.unitPrice, currency)}
          </span>
        ) : null}

        {!pending && resultat?.type === "inconnu" ? (
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            Code {resultat.code} inconnu — ajoutez-le dans Produits, ou saisissez la ligne à
            la main.
          </span>
        ) : null}
      </p>
    </div>
  );
}
