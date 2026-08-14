import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopSearch } from "@/components/layout/top-search";
import { getSession } from "@/lib/auth/session";
import { supabaseDataEnabled } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // À l'étape 4, la redirection vers /login se posera ici — dans le layout
  // serveur, pas dans le middleware (cf. CVE-2025-29927).
  const session = await getSession();

  return (
    <div className="min-h-screen bg-surface">
      {/* `print:hidden` : la feuille imprimée ne doit contenir que le document. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-border bg-background lg:block print:hidden">
        <Sidebar user={session.user} canSignOut={supabaseDataEnabled()} />
      </aside>

      <div className="lg:pl-[236px] print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-surface/85 px-4 backdrop-blur sm:px-6 print:hidden">
          <MobileNav user={session.user} canSignOut={supabaseDataEnabled()} />
          <Link href="/dashboard" className="lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center">
            <TopSearch />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
