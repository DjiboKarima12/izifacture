import { redirect } from "next/navigation";

/**
 * La landing page arrive à l'étape 5. En attendant, la racine mène directement
 * à l'application.
 */
export default function HomePage() {
  redirect("/dashboard");
}
