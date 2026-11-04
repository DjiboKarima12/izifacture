import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  // Si le type n'est pas dans l'URL mais qu'on a un token_hash, on force "recovery" par défaut
  const type = (searchParams.get("type") as EmailOtpType) || "recovery";
  const next = searchParams.get("next") ?? "/reset-password";

  const supabase = createSupabaseServerClient();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Erreur verifyOtp:", error.message);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
}