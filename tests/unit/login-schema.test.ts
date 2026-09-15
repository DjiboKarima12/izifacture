import { describe, expect, it } from "vitest";
import { z } from "zod";

import { emailSchema } from "@/lib/domain/schemas";
import { completerIdentifiant } from "@/lib/members";

/**
 * Reproduit EXACTEMENT le schéma de `signIn`.
 *
 * Écrit après avoir livré un correctif qui n'avait pas été appliqué : le
 * remplacement dans `auth.ts` avait échoué en silence, et rien ne l'a signalé
 * parce qu'aucun test ne traversait ce chemin. Une transformation de saisie qui
 * n'est vérifiée nulle part est une transformation qui peut disparaître.
 */
const loginSchema = z.object({
  email: z.string().trim().transform(completerIdentifiant).pipe(emailSchema),
  password: z.string().min(8),
});

const connexion = (email: string) =>
  loginSchema.safeParse({ email, password: "Adim1510" });

describe("saisie de connexion", () => {
  it("un identifiant nu est accepté et complété", () => {
    const parsed = connexion("majida");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("majida@caisse.mamafacture.app");
  });

  it("les majuscules et les espaces ne gênent pas", () => {
    const parsed = connexion("  MAJIDA ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("majida@caisse.mamafacture.app");
  });

  it("une vraie adresse passe intacte", () => {
    const parsed = connexion("karimadjibo65@gmail.com");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("karimadjibo65@gmail.com");
  });

  it("une saisie trop courte est refusée comme telle, pas complétée", () => {
    expect(connexion("aw").success).toBe(false);
  });

  it("un mot de passe trop court reste refusé", () => {
    expect(loginSchema.safeParse({ email: "majida", password: "court" }).success).toBe(false);
  });
});
