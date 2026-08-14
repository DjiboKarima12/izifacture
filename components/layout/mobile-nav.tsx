"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";

/**
 * Tiroir de navigation mobile. Les utilisateurs cibles sont majoritairement sur
 * téléphone : la navigation complète doit rester atteignable en une frappe, et
 * c'est exactement la même sidebar qu'en desktop — pas une version réduite.
 */
export function MobileNav({
  user,
  canSignOut = false,
}: {
  user: { name: string; email: string };
  canSignOut?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  /**
   * Fermeture sur changement d'URL, et non au clic.
   *
   * Next enveloppe la navigation d'un <Link> dans une transition React : un
   * `setOpen(false)` déclenché depuis le gestionnaire de clic est happé par
   * cette transition et reste en attente jusqu'à la fin du rendu — le tiroir
   * restait donc ouvert par-dessus la nouvelle page. Réagir à l'URL ferme aussi
   * le tiroir sur un retour arrière ou une redirection.
   */
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <Menu className="size-5" aria-hidden />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 animate-overlay-in lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-background shadow-raised animate-fade-in lg:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navigation principale de l&apos;application
          </Dialog.Description>
          <Sidebar user={user} canSignOut={canSignOut} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
