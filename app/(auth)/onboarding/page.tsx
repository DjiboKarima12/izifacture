import type { Metadata } from "next";

import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Votre entreprise" };

/**
 * Un compte peut exister sans organisation : inscription avec confirmation par
 * email, ou membre retiré de la sienne. `getSession()` redirige ici plutôt que
 * d'afficher des écrans vides.
 */
export default function OnboardingPage() {
  return <OnboardingForm />;
}
