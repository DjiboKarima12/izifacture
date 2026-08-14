"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { signOut } from "@/lib/actions/auth";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Sidebar({
  user,
  onNavigate,
  canSignOut = false,
}: {
  user: { name: string; email: string };
  onNavigate?: () => void;
  /** Masqué en mode démonstration : il n'y a aucune session à quitter. */
  canSignOut?: boolean;
}) {
  const pathname = usePathname();
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/dashboard" className="px-2" onClick={onNavigate}>
        <Logo />
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <nav className="flex flex-col gap-0.5" aria-label={group.label}>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-[17px] shrink-0", active && "text-interactive")}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border px-2 pt-4">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
          aria-hidden
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>

        {/* Formulaire et non bouton : la déconnexion doit fonctionner même si le
            JavaScript n'a pas encore été chargé. */}
        {canSignOut ? (
          <form action={signOut} className="ml-auto">
            <button
              type="submit"
              aria-label="Se déconnecter"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
