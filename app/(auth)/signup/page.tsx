import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  return <AuthForm mode="signup" next={safeNextPath(searchParams.next)} />;
}
