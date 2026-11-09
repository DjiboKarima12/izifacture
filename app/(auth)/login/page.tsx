import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  return <AuthForm mode="signin" next={safeNextPath(searchParams.next)} />;
}
