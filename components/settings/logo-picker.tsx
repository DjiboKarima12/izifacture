"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  LOGO_MAX_BYTES,
  LOGO_MAX_DIMENSION,
  LOGO_MIME_TYPES,
  isValidLogo,
  logoByteLength,
} from "@/lib/domain/logo";

/**
 * Choix du logo affiché sur le reçu.
 *
 * L'image est REDIMENSIONNÉE DANS LE NAVIGATEUR avant d'être envoyée. Sans ça,
 * la photo prise au téléphone qui sert de logo à la plupart des petites
 * entreprises ferait plusieurs mégaoctets et dépasserait le plafond : on
 * refuserait un fichier parfaitement légitime en demandant à l'utilisateur de
 * le réduire lui-même, ce qu'il ne saura pas faire.
 *
 * Le canvas ré-encode l'image en PNG à partir des pixels décodés. C'est un
 * effet de bord utile : ce qui sort ne contient plus que des pixels — ni
 * métadonnées EXIF (la position GPS d'une photo, par exemple), ni charge cachée
 * dans un format d'image détourné.
 */
export function LogoPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  const logo = isValidLogo(value) ? value : null;

  const pick = async (file: File) => {
    setError(null);
    setWorking(true);

    try {
      const resized = await resizeToDataUri(file);

      if (!resized || !isValidLogo(resized)) {
        setError(
          `Impossible de faire tenir cette image sous ${Math.round(LOGO_MAX_BYTES / 1024)} Ko, ` +
            "même très réduite. Essayez une image moins détaillée.",
        );
        return;
      }

      onChange(resized);
    } catch {
      setError("Image illisible. Formats acceptés : PNG, JPEG, WebP.");
    } finally {
      setWorking(false);
      // Permet de resélectionner le même fichier après une correction.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI : rien à optimiser, et `next/image` refuse ce schéma.
            <img src={logo} alt="Logo de l'entreprise" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || working}
              onClick={() => inputRef.current?.click()}
            >
              {working ? "Traitement…" : logo ? "Changer" : "Choisir une image"}
            </Button>

            {logo ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || working}
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
              >
                <Trash2 aria-hidden />
                Retirer
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {logo
              ? `Réduite et enregistrée : ${Math.max(1, Math.round(logoByteLength(logo) / 1024))} Ko.`
              : "PNG, JPEG ou WebP. L'image est réduite automatiquement."}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LOGO_MIME_TYPES.join(",")}
        className="sr-only"
        disabled={disabled || working}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Le logo remplace le nom en haut du reçu. Les tickets s&apos;impriment en noir et blanc :
        une image contrastée ressort mieux qu&apos;un dégradé.
      </p>
    </div>
  );
}

/** Tailles essayées, du plus net au plus léger. */
const DIMENSIONS = [LOGO_MAX_DIMENSION, 320, 240];

/** Qualités JPEG essayées à chaque taille. */
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

/**
 * Décode l'image, la réduit, et cherche le meilleur encodage qui tienne sous le
 * plafond.
 *
 * POURQUOI DEUX FORMATS — le PNG est sans perte : parfait pour un logo dessiné
 * (aplats, peu de couleurs, transparence conservée), catastrophique pour une
 * photo, où il pèse des centaines de kilo-octets même réduit à 480 px. Le JPEG
 * fait l'inverse. Essayer le PNG d'abord et retomber sur le JPEG donne le
 * meilleur des deux sans rien demander à l'utilisateur.
 *
 * Le JPEG ne connaît pas la transparence : le fond est peint en blanc avant
 * l'encodage, sinon les zones transparentes ressortiraient en noir — ce qui, sur
 * un logo découpé, donne un rectangle noir en haut du reçu.
 *
 * `createImageBitmap` plutôt qu'une balise image masquée : il décode hors du fil
 * principal et ne dépend pas d'un cycle de chargement à surveiller.
 */
async function resizeToDataUri(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);

  try {
    for (const dimension of DIMENSIONS) {
      const scale = Math.min(dimension / bitmap.width, dimension / bitmap.height, 1);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      // Sans fond : garde la transparence pour la tentative PNG.
      const transparent = paint(bitmap, width, height, false);
      const png = transparent.toDataURL("image/png");
      if (png.length <= LOGO_MAX_BYTES) return png;

      const opaque = paint(bitmap, width, height, true);
      for (const quality of QUALITIES) {
        const jpeg = opaque.toDataURL("image/jpeg", quality);
        if (jpeg.length <= LOGO_MAX_BYTES) return jpeg;
      }
    }

    return null;
  } finally {
    bitmap.close();
  }
}

function paint(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  onWhite: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas indisponible");

  if (onWhite) {
    // Ce blanc n'est PAS une couleur d'interface et ne doit pas venir d'un
    // token : il devient un pixel du fichier image, et le reçu s'imprime sur du
    // papier blanc. Adossé au thème, il virerait au noir en mode sombre et le
    // logo sortirait sur un rectangle sombre.
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}
