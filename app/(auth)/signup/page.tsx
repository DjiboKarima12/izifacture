import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
